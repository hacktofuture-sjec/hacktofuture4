const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const axios = require('axios');
const { processChatMessage } = require('../services/chatService');
const { processNewComplaint } = require('../services/complaintService');
const { processWhatsAppMedia } = require('../services/mediaService');
const User = require('../models/User');

const MessagingResponse = twilio.twiml.MessagingResponse;

// 🧠 In-memory session store (Phone Number -> { title, imageUrl, lat, lng })
const userSessions = new Map();

/**
 * 🖼️ Authenticated Media Proxy for Twilio Images
 * Allows web browsers to render Twilio WhatsApp attachments without authentication errors.
 */
router.get('/media-proxy', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).send('Missing url parameter');

    try {
        const response = await axios.get(rawUrl, {
            auth: {
                username: process.env.TWILIO_ACCOUNT_SID,
                password: process.env.TWILIO_AUTH_TOKEN
            },
            responseType: 'stream',
            timeout: 15000
        });

        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        response.data.pipe(res);
    } catch (err) {
        console.error('💥 Media proxy streaming error:', err.message);
        res.status(500).send('Failed to fetch media');
    }
});

/**
 * 📱 Stateful WhatsApp Webhook
 * Flow: Complaint Text / Voice -> Ask for Photo Evidence -> Ask for Location Pin -> Submit
 */
router.post('/', async (req, res) => {
    try {
        const twiml = new MessagingResponse();
        const incomingMsg = req.body.Body ? req.body.Body.trim() : "";
        const sender = req.body.From || "";
        const lat = req.body.Latitude;
        const lng = req.body.Longitude;
        
        // Twilio sends media files in MediaUrl0, MediaUrl1, etc.
        const numMedia = parseInt(req.body.NumMedia || "0", 10);
        const incomingMediaUrl = numMedia > 0 ? req.body.MediaUrl0 : (req.body.imageUrl || req.body.MediaUrl || null);

        console.log(`-----------------------------------------`);
        console.log(`📩 WhatsApp Flow Triggered for ${sender}`);
        if (incomingMediaUrl) console.log(`📸 Image received: ${incomingMediaUrl}`);
        if (lat && lng) console.log(`📍 GPS Pin received: ${lat}, ${lng}`);

        let session = userSessions.get(sender) || {};

        // SCENARIO 1: USER ATTACHES AN EVIDENCE PHOTO 📸
        if (incomingMediaUrl) {
            // Process and store media locally for immediate display
            const accessibleUrl = await processWhatsAppMedia(incomingMediaUrl);
            session.imageUrl = accessibleUrl;

            // If user also sent a text caption with the photo
            if (incomingMsg && incomingMsg.length > 5 && !session.title) {
                session.title = incomingMsg;
            }

            userSessions.set(sender, session);

            if (!session.title) {
                twiml.message(`📸 *Photo Evidence Received!*\n\n📝 What is the issue? Please type a brief description of the problem.`);
                res.set('Content-Type', 'text/xml');
                return res.status(200).send(twiml.toString());
            }

            if (!lat && !lng) {
                twiml.message(`📸 *Photo Evidence Attached!*\n\n📍 Final Step: Please share your *GPS Location pin* (tap 📎 ➔ *Location* ➔ *Send Current Location*) to complete the report.`);
                res.set('Content-Type', 'text/xml');
                return res.status(200).send(twiml.toString());
            }
        }

        // SCENARIO 2: USER SAYS 'SKIP' FOR PHOTO ⏭️
        if (incomingMsg.toLowerCase() === 'skip' || incomingMsg.toLowerCase() === 'no photo') {
            if (session.title && (!lat || !lng)) {
                twiml.message(`Got it! 👍\n\n📍 Now please share your *GPS Location pin* (tap 📎 ➔ *Location*) to finish submitting.`);
                res.set('Content-Type', 'text/xml');
                return res.status(200).send(twiml.toString());
            }
        }

        // SCENARIO 3: USER SHARES LOCATION PIN 📍
        if (lat && lng) {
            const pendingTitle = session.title;

            if (!pendingTitle) {
                session.lat = lat;
                session.lng = lng;
                userSessions.set(sender, session);

                twiml.message("📍 *Location Pin Received!*\n\nWhat is the problem? 🧐 Please type your complaint description.");
                res.set('Content-Type', 'text/xml');
                return res.status(200).send(twiml.toString());
            }

            // --- PROCESS FINAL COMPLAINT ---
            // Identity Check
            const cleanPhone = sender.replace('whatsapp:', '');
            let user = await User.findOne({ phoneNumber: cleanPhone });
            if (!user) {
                user = await User.create({
                    name: `Citizen ${cleanPhone.slice(-4)}`,
                    email: `${cleanPhone}@jansetu.city`,
                    phoneNumber: cleanPhone,
                    password: "tempPassword123"
                });
            }

            // --- REVERSE GEOCODING: Convert GPS to Address ---
            let readableLocation = "WhatsApp Shared Location";
            try {
                const geoRes = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
                    headers: { 'User-Agent': 'JanSetu-Smart-City' }
                });
                if (geoRes.data && geoRes.data.display_name) {
                    readableLocation = geoRes.data.display_name;
                }
                console.log(`📍 Geocoded Full Address: ${readableLocation}`);
            } catch (geoErr) {
                console.error("Geocoding failed, using fallback:", geoErr.message);
            }

            const complaint = await processNewComplaint({
                title: pendingTitle,
                location: readableLocation,
                userId: user._id,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                imageUrl: session.imageUrl || null
            });

            // Clear session after success
            userSessions.delete(sender);

            const hasPhoto = !!complaint.imageUrl;
            twiml.message(`✅ *Complaint Registered Successfully!*\n\nReference: #${complaint._id.toString().slice(-6)}\nDepartment: *${complaint.department}*\nLocation: ${readableLocation}\n${hasPhoto ? '📸 *Evidence Photo Attached*\n' : ''}\nYour issue has been dispatched to the municipal response team.`);
            res.set('Content-Type', 'text/xml');
            return res.status(200).send(twiml.toString());
        }

        // SCENARIO 4: USER SENDS COMPLAINT TEXT 📝
        if (incomingMsg.length > 5) {
            session.title = incomingMsg;
            userSessions.set(sender, session);
            
            twiml.message(`I've noted your report:\n*"${incomingMsg}"*\n\n📸 *Step 1/2:* Please send a *Photo of the issue* as evidence (or reply *'skip'*).\n\n📍 *Step 2/2:* Share your *GPS Location pin* (tap 📎 ➔ Location).`);
            res.set('Content-Type', 'text/xml');
            return res.status(200).send(twiml.toString());
        }

        // SCENARIO 5: GENERAL QUERY (Asking for stats, FAQs, etc.)
        const aiReply = await processChatMessage(incomingMsg, sender);
        twiml.message(aiReply);
        
        res.set('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());

    } catch (error) {
        console.error("💥 WhatsApp Flow Error:", error.message);
        const twiml = new MessagingResponse();
        twiml.message("JanSetu AI is synchronizing city data. Please try again.");
        res.set('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());
    }
});

module.exports = router;


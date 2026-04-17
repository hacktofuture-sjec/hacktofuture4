const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const axios = require('axios');
const { processChatMessage } = require('../services/chatService');
const { processNewComplaint } = require('../services/complaintService');
const User = require('../models/User');

const MessagingResponse = twilio.twiml.MessagingResponse;

// 🧠 In-memory session store (Phone Number -> Last Message)
const userSessions = new Map();

/**
 * 📱 Stateful WhatsApp Webhook
 * Handles the Flow: Message -> Ask for Location -> Combine & Submit
 */
router.post('/', async (req, res) => {
    try {
        const twiml = new MessagingResponse();
        const incomingMsg = req.body.Body ? req.body.Body.trim() : "";
        const sender = req.body.From || "";
        const lat = req.body.Latitude;
        const lng = req.body.Longitude;

        console.log(`-----------------------------------------`);
        console.log(`📩 Flow Triggered for ${sender}`);

        // SCENARIO 1: USER SHARES LOCATION PIN 📍
        if (lat && lng) {
            const pendingIssue = userSessions.get(sender);

            if (!pendingIssue) {
                twiml.message("I've received your location, but what is the problem? 🧐 Please type your complaint first.");
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
                    readableLocation = geoRes.data.display_name.split(',').slice(0, 3).join(','); // Get first 3 parts of address
                }
                console.log(`📍 Geocoded Address: ${readableLocation}`);
            } catch (geoErr) {
                console.error("Geocoding failed, using fallback:", geoErr.message);
            }

            const complaint = await processNewComplaint({
                title: pendingIssue,
                location: readableLocation,
                userId: user._id,
                lat: parseFloat(lat),
                lng: parseFloat(lng)
            });

            // Clear session after success
            userSessions.delete(sender);

            twiml.message(`✅ *Complaint Registered Successfully!*\n\nReference: ${complaint._id.toString().slice(-6)}\nDepartment: *${complaint.department}*\n\nYour location has been mapped and teams are synchronized.`);
            res.set('Content-Type', 'text/xml');
            return res.status(200).send(twiml.toString());
        }

        // SCENARIO 2: USER SENDS TEXT (The Complaint) 📝
        if (incomingMsg.length > 5) {
            // Save to session and ask for location
            userSessions.set(sender, incomingMsg);
            
            twiml.message(`I've noted your report: "${incomingMsg}"\n\n📍 To complete the submission, please share your *Live Location* using the WhatsApp "Location" feature.`);
            res.set('Content-Type', 'text/xml');
            return res.status(200).send(twiml.toString());
        }

        // SCENARIO 3: GENERAL QUERY (Asking for stats, etc.)
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

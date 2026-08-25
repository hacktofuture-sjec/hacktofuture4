const fs = require('fs');
const path = require('path');
const axios = require('axios');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Downloads WhatsApp media from Twilio (which requires HTTP Basic Auth)
 * and stores it locally in the /uploads directory.
 * Returns the public accessible URL path.
 */
async function processWhatsAppMedia(mediaUrl) {
    if (!mediaUrl) return null;

    // If it's not a Twilio URL, return as is (e.g. Cloudinary, Unsplash, or already local)
    if (!mediaUrl.includes('api.twilio.com')) {
        return mediaUrl;
    }

    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        console.log(`📥 Downloading Twilio Media from: ${mediaUrl}`);

        const response = await axios.get(mediaUrl, {
            auth: {
                username: accountSid,
                password: authToken
            },
            responseType: 'arraybuffer',
            timeout: 15000
        });

        // Determine extension from content-type or fallback to .jpg
        const contentType = response.headers['content-type'] || 'image/jpeg';
        let ext = '.jpg';
        if (contentType.includes('png')) ext = '.png';
        else if (contentType.includes('webp')) ext = '.webp';
        else if (contentType.includes('gif')) ext = '.gif';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';

        const fileName = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        fs.writeFileSync(filePath, Buffer.from(response.data));
        console.log(`✅ WhatsApp media saved locally to: ${filePath}`);

        // Return the static URL path
        return `http://localhost:5000/uploads/${fileName}`;
    } catch (err) {
        console.error('❌ Failed to download Twilio media locally:', err.message);
        // Fallback to proxy route
        return `http://localhost:5000/api/whatsapp/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
    }
}

module.exports = { processWhatsAppMedia, UPLOADS_DIR };

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { processChatMessage } = require('../services/chatService');

/**
 * Web-based Chatbot Route (Public)
 */
router.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        const reply = await processChatMessage(message);
        
        return res.json({
            success: true,
            reply
        });
    } catch (error) {
        console.error("Web Chat Route Error:", error.message);
        res.status(500).json({ success: false, reply: "Internal Server Processing Error" });
    }
});

module.exports = router;
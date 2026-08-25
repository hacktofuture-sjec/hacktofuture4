const axios = require('axios');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { processNewComplaint } = require('./complaintService');

/**
 * High-Precision JanSetu Brain (Filtered Queries)
 */
const processChatMessage = async (message, senderPhone = null, coords = { lat: null, lng: null }) => {
    try {
        if (!message && !coords.lat) return "Welcome. How can I assist you?";
        const lowerMsg = (message || "").toLowerCase();

        // 1. DATA SNAPSHOT
        const allComplaints = await Complaint.find();
        const total = allComplaints.length;
        const highPriorityCount = allComplaints.filter(c => c.priority === 'High').length;
        const resolvedCount = allComplaints.filter(c => c.status === 'Resolved').length;

        // 2. SPECIFIC FILTERED QUERIES (One-liner Responses)
        if (lowerMsg.includes('how many high priority') || lowerMsg.includes('high priority count')) {
            return `There are currently *${highPriorityCount}* high priority complaints requiring immediate attention.`;
        }
        if (lowerMsg.includes('how many resolved') || lowerMsg.includes('resolved count')) {
            return `A total of *${resolvedCount}* civic issues have been successfully resolved by city departments.`;
        }
        if (lowerMsg.includes('how many total') || lowerMsg.includes('total complaints count')) {
            return `There are exactly *${total}* complaints currently logged in the JanSetu system.`;
        }

        // --- Department Analysis ---
        const deptMap = {};
        allComplaints.forEach(c => {
            const d = c.department || "Unassigned";
            deptMap[d] = (deptMap[d] || 0) + 1;
        });
        const sortedDepts = Object.entries(deptMap).sort((a,b) => b[1] - a[1]);
        const topDept = sortedDepts[0] ? sortedDepts[0][0] : "None";
        const topDeptCount = sortedDepts[0] ? sortedDepts[0][1] : 0;

        // --- Location Analysis (Hotspots) ---
        const locationMap = {};
        allComplaints.forEach(c => {
            const loc = (c.location || "Unknown").split(',')[0]; // Keep it short
            locationMap[loc] = (locationMap[loc] || 0) + 1;
        });
        const sortedHotspots = Object.entries(locationMap).sort((a, b) => b[1] - a[1]).filter(h => h[0] !== "Unknown");
        const topHotspot = sortedHotspots[0] ? sortedHotspots[0][0] : "Distributed";

        // 3. MULTI-INTENT DETECTION
        const isAskingDept = ['department', 'dept', 'team', 'load'].some(kw => lowerMsg.includes(kw));
        const isAskingHotspot = ['hotspot', 'crowded', 'worst area'].some(kw => lowerMsg.includes(kw));
        const isAskingStats = ['stats', 'summary', 'overview'].some(kw => lowerMsg.includes(kw));
        const reportKeywords = ['report', 'issue', 'leak', 'broken', 'pothole', 'accident', 'garbage', 'danger', 'college'];
        let isReporting = reportKeywords.some(kw => lowerMsg.includes(kw)) || coords.lat;

        // --- SCENARIO: DEPARTMENT QUERY ---
        if (isAskingDept && !lowerMsg.includes('how many')) {
            return `The *${topDept}* department has the highest load with *${topDeptCount}* active complaints.`;
        }

        // --- SCENARIO: HOTSPOT QUERY ---
        if (isAskingHotspot) {
            return `The current hotspot for civic issues is the *${topHotspot}* area.`;
        }

        // --- SCENARIO: GENERAL STATS SUMMARY ---
        if (isAskingStats) {
            return `📊 *CITY STATUS*\n• Total: ${total}\n• High Priority: ${highPriorityCount}\n• Top Hotspot: ${topHotspot}\n• Max Load: ${topDept}`;
        }

        // Logic for Reporting remains the same
        let analysis = { intent: isReporting ? "REPORT" : "ASK", extractedTitle: message ? message.slice(0, 50) : "Report", extractedLocation: "Mangalore" };
        try {
            const intentPrompt = `Analyze: "${message}". JSON: {"intent": "REPORT", "title": "...", "location": "..."}`;
            const { data } = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama3-8b-8192', messages: [{ role: "user", content: intentPrompt }], response_format: { type: "json_object" }
            }, { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY?.trim()}` } });
            const aiResultJSON = JSON.parse(data.choices[0].message.content);
            analysis = { ...analysis, ...aiResultJSON };
        } catch (e) { }

        if (analysis.intent === "REPORT") {
            const cleanPhone = (senderPhone || "").replace('whatsapp:', '');
            let user = await User.findOne({ phoneNumber: cleanPhone });
            if (!user && cleanPhone) {
                user = await User.create({ name: `Citizen ${cleanPhone.slice(-4)}`, email: `${cleanPhone}@jansetu.city`, phoneNumber: cleanPhone, password: "temp123" });
            }
            const complaint = await processNewComplaint({
                title: analysis.extractedTitle, location: analysis.extractedLocation,
                userId: user ? user._id : "67af1c000000000000000000",
                lat: coords.lat, lng: coords.lng
            });
            return `✅ *Action Logged*\nIssue: "${complaint.title}"\nDept: *${complaint.department}*\nID: ${complaint._id.toString().slice(-6)}`;
        }

        return `Welcome to JanSetu. Currently tracking *${total}* reports. You can report an issue or ask for city stats.`;

    } catch (error) {
        console.error("Critical Failure:", error.message);
        return "JanSetu system is synchronizing. Please try again.";
    }
};

module.exports = { processChatMessage };

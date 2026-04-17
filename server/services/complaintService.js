const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { analyzeWithGroq } = require('../services/groqService');
const { assignCluster } = require('../services/clusteringService');
const { calculatePriority } = require('../services/priorityService');
const { assignDepartment } = require('../services/assignmentService');
const { sendStatusEmail, sendDepartmentAlert } = require('../services/notificationService');

/**
 * Core Core JanSetu Complaint Processing Engine
 * Shared between Web and WhatsApp
 */
const processNewComplaint = async ({ title, location, userId, lat, lng, imageUrl, userEmail }) => {
    try {
        // 1. Initial creation
        let complaint = await Complaint.create({ 
            title, 
            text: title, // Text is same as title for AI analysis
            imageUrl, 
            location, 
            lat, 
            lng,
            userId 
        });

        // 2. AI Brain Analysis (Groq)
        const analysis = await analyzeWithGroq(title);
        complaint.category = analysis.category;
        complaint.severity = analysis.severity;
        complaint.keywords = analysis.keywords;

        // 3. AI Clustering
        complaint.clusterId = await assignCluster(title);

        // 4. Priority & SLA Calculation
        const { priorityScore, priorityLabel, deadline } = await calculatePriority(complaint.severity, complaint.clusterId);
        complaint.priorityScore = priorityScore;
        complaint.priority = priorityLabel;
        complaint.deadline = deadline;

        // 5. Departmental Dispatch
        complaint.department = assignDepartment(complaint.category, title);
        complaint.status = 'Assigned';

        // 6. User Rewards
        await User.findByIdAndUpdate(userId, { $inc: { rewardPoints: 10 } });

        // 7. Save Final Matrix
        await complaint.save();

        // 8. Notifications
        try {
            if (userEmail) await sendStatusEmail(userEmail, complaint.title, 'Successfully Logged & Dispatched');
            
            const deptAuthorities = await User.find({ role: 'authority', department: complaint.department });
            await Promise.all(deptAuthorities.map(auth => sendDepartmentAlert(auth.email, complaint)));
        } catch (e) { console.error('Notification Error:', e.message); }

        return complaint;
    } catch (err) {
        throw new Error(err.message);
    }
};

module.exports = { processNewComplaint };

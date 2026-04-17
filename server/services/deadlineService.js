const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { sendEscalationEmail } = require('./notificationService');

const runDeadlineCheck = async () => {
  try {
    console.log('🕒 JANSETU: Running Deep Deadline Audit...');
    
    // Find all complaints that are past deadline and NOT resolved
    const overdue = await Complaint.find({
      deadline: { $lt: new Date() },
      status: { $ne: 'Resolved' }
    }).populate('userId', 'email');

    console.log(`🔍 Found ${overdue.length} overdue reports.`);

    for (const complaint of overdue) {
      // 1. Alert the Citizen
      if (complaint.userId && complaint.userId.email) {
        await sendEscalationEmail(complaint.userId.email, complaint, 'citizen');
      }

      // 2. Alert the Department Authorities
      const deptAuths = await User.find({ role: 'authority', department: complaint.department });
      for (const auth of deptAuths) {
        await sendEscalationEmail(auth.email, complaint, 'authority');
      }
      
      // Optionally mark as "Escalated" in a custom field if we had one
      // For now, it stays same status but triggers mails
    }

    if (overdue.length > 0) {
        console.log(`✅ JANSETU: Escalation Protocols Dispatched for ${overdue.length} cases.`);
    }

  } catch (error) {
    console.error('❌ Deadline Audit Error:', error.message);
  }
};

module.exports = { runDeadlineCheck };

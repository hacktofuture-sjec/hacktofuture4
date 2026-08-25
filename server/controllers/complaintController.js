const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { processNewComplaint } = require('../services/complaintService');
const { verifyResolutionWithAI } = require('../services/verificationService');

/**
 * Handle Web Submissions
 */
const submitComplaint = async (req, res) => {
  try {
    const { title, text, imageUrl, location, lat, lng } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const complaint = await processNewComplaint({
        title,
        location,
        userId: req.user._id,
        userEmail: req.user.email,
        lat,
        lng,
        imageUrl
    });

    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    console.error('💥 SUBMIT COMPLAINT CRASH:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const sanitizeComplaintImageUrl = (url) => {
  if (!url) return url;
  if (url.includes('api.twilio.com')) {
    return `http://localhost:5000/api/whatsapp/media-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const formatComplaint = (c) => {
  const obj = c.toObject ? c.toObject() : { ...c };
  if (obj.imageUrl) obj.imageUrl = sanitizeComplaintImageUrl(obj.imageUrl);
  if (obj.resolutionImageUrl) obj.resolutionImageUrl = sanitizeComplaintImageUrl(obj.resolutionImageUrl);
  return obj;
};

const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints.map(formatComplaint) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints.map(formatComplaint) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAuthorityStats = async (req, res) => {
  try {
    const total = await Complaint.countDocuments({});
    const highPriority = await Complaint.countDocuments({ priority: 'High' });
    
    const categoryStats = await Complaint.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const deptStats = await Complaint.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        total,
        highPriority,
        mostCommon: categoryStats[0]?._id || 'None',
        categoryStats,
        deptStats
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDepartmentComplaints = async (req, res) => {
  try {
    const isGlobalAdmin = req.user.role === 'admin' || !req.user.department || req.user.department === 'City Administration';
    const query = isGlobalAdmin ? {} : { department: req.user.department };
    const complaints = await Complaint.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints.map(formatComplaint) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateComplaintStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const complaint = await Complaint.findById(req.params.id).populate('userId', 'email');
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    if (req.user.role !== 'admin' && complaint.department !== req.user.department) {
      return res.status(403).json({ message: 'Unauthorized for this department' });
    }

    complaint.status = status;
    await complaint.save();

    res.json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resolveComplaintWithAI = async (req, res) => {
  try {
    const { resolutionImageUrl, resolutionNote } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    if (req.user.role !== 'admin' && complaint.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'Unauthorized for this department' });
    }

    if (!resolutionImageUrl) {
      return res.status(400).json({ success: false, message: 'Resolution photo is required for verification' });
    }

    // Run AI Inspection
    const aiResult = await verifyResolutionWithAI({
      title: complaint.title,
      category: complaint.category,
      beforeImageUrl: complaint.imageUrl,
      afterImageUrl: resolutionImageUrl,
      resolutionNote
    });

    complaint.resolutionImageUrl = resolutionImageUrl;
    complaint.resolutionNote = resolutionNote || '';
    complaint.verificationStatus = aiResult.status;
    complaint.verificationScore = aiResult.confidence;
    complaint.verificationVerdict = aiResult.verdict;

    if (aiResult.status === 'Rejected') {
      complaint.fraudAuditFlag = true;
      complaint.status = 'In Progress'; // Keep ticket open
      await complaint.save();

      return res.status(400).json({
        success: false,
        verified: false,
        message: `AI Inspection Alert: Closure rejected. ${aiResult.verdict}`,
        data: complaint
      });
    }

    // Approved by AI
    complaint.status = 'Resolved';
    complaint.resolvedAt = new Date();
    complaint.fraudAuditFlag = false;
    await complaint.save();

    res.json({
      success: true,
      verified: true,
      message: `AI Verification Passed (${aiResult.confidence}% confidence): ${aiResult.verdict}`,
      data: complaint
    });
  } catch (error) {
    console.error('Resolution verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDepartmentScores = async (req, res) => {
  try {
    const departments = ['Sanitation', 'Water Supply', 'Electric Board', 'Public Works', 'Police', 'General'];
    const allComplaints = await Complaint.find({});
    const now = new Date();

    const scores = departments.map(dept => {
      const deptComplaints = allComplaints.filter(c => c.department === dept);
      const total = deptComplaints.length;
      
      if (total === 0) {
        return {
          department: dept,
          total: 0,
          resolved: 0,
          inProgress: 0,
          assigned: 0,
          resolutionRate: 100,
          slaComplianceRate: 100,
          aiQualityScore: 90,
          auditFlagsCount: 0,
          performanceScore: 90,
          grade: 'A',
          badge: 'Standing By'
        };
      }

      const resolvedList = deptComplaints.filter(c => c.status === 'Resolved');
      const resolved = resolvedList.length;
      const inProgress = deptComplaints.filter(c => c.status === 'In Progress').length;
      const assigned = deptComplaints.filter(c => c.status === 'Assigned' || c.status === 'Pending').length;
      
      // 1. Resolution Rate (0 - 100%)
      const resolutionRate = Math.round((resolved / total) * 100);

      // 2. SLA Compliance Rate (% not overdue)
      const onTimeComplaints = deptComplaints.filter(c => {
        if (c.status === 'Resolved') {
          return !c.deadline || (c.resolvedAt && c.resolvedAt <= c.deadline);
        }
        return !c.deadline || new Date(c.deadline) >= now;
      });
      const slaComplianceRate = Math.round((onTimeComplaints.length / total) * 100);

      // 3. AI Quality & Verification Score
      const verifiedResolutions = resolvedList.filter(c => c.verificationScore > 0);
      const avgAiScore = verifiedResolutions.length > 0
        ? Math.round(verifiedResolutions.reduce((acc, c) => acc + c.verificationScore, 0) / verifiedResolutions.length)
        : (resolved > 0 ? 85 : 75);

      // 4. Audit Flags Penalty
      const auditFlagsCount = deptComplaints.filter(c => c.fraudAuditFlag).length;

      // Combined Performance Formula: (45% Resolution + 35% SLA + 20% AI Quality) - Penalty
      let rawScore = Math.round(
        (resolutionRate * 0.45) + 
        (slaComplianceRate * 0.35) + 
        (avgAiScore * 0.20) - 
        (auditFlagsCount * 6)
      );
      const performanceScore = Math.max(20, Math.min(100, rawScore));

      // Grade assignment
      let grade = 'C';
      let badge = 'Needs Attention';
      if (performanceScore >= 90) { grade = 'A+'; badge = 'Top Performer 🏆'; }
      else if (performanceScore >= 80) { grade = 'A'; badge = 'Fast & Efficient ⚡'; }
      else if (performanceScore >= 70) { grade = 'B'; badge = 'Good Response 👍'; }
      else if (performanceScore >= 60) { grade = 'C'; badge = 'Moderate Backlog ⚠️'; }
      else { grade = 'D'; badge = 'Critical Review Required 🚨'; }

      return {
        department: dept,
        total,
        resolved,
        inProgress,
        assigned,
        resolutionRate,
        slaComplianceRate,
        aiQualityScore: avgAiScore,
        auditFlagsCount,
        performanceScore,
        grade,
        badge
      };
    });

    // Sort by performance score descending
    scores.sort((a, b) => b.performanceScore - a.performanceScore);

    res.json({ success: true, data: scores });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { 
  submitComplaint, 
  getMyComplaints, 
  getAllComplaints, 
  getAuthorityStats, 
  getDepartmentComplaints, 
  updateComplaintStatus,
  resolveComplaintWithAI,
  getDepartmentScores
};



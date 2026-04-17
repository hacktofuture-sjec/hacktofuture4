const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { processNewComplaint } = require('../services/complaintService');

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

const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints });
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
    const complaints = await Complaint.find({ department: req.user.department }).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateComplaintStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const complaint = await Complaint.findById(req.params.id).populate('userId', 'email');
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    if (complaint.department !== req.user.department) {
      return res.status(403).json({ message: 'Unauthorized for this department' });
    }

    complaint.status = status;
    await complaint.save();

    res.json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitComplaint, getMyComplaints, getAllComplaints, getAuthorityStats, getDepartmentComplaints, updateComplaintStatus };

const express = require('express');
const router = express.Router();
const { 
  submitComplaint, 
  getMyComplaints, 
  getAllComplaints,
  getAuthorityStats,
  getDepartmentComplaints, 
  updateComplaintStatus 
} = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('citizen'), submitComplaint);
router.get('/my', protect, authorize('citizen'), getMyComplaints);
router.get('/all', protect, authorize('authority'), getAllComplaints);
router.get('/stats', protect, authorize('authority'), getAuthorityStats);
router.get('/department', protect, authorize('authority'), getDepartmentComplaints);
router.patch('/:id/status', protect, authorize('authority'), updateComplaintStatus);

module.exports = router;

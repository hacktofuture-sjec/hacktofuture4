const express = require('express');
const router = express.Router();
const { 
  submitComplaint, 
  getMyComplaints, 
  getAllComplaints,
  getAuthorityStats,
  getDepartmentComplaints, 
  updateComplaintStatus,
  resolveComplaintWithAI,
  getDepartmentScores
} = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('citizen'), submitComplaint);
router.get('/my', protect, authorize('citizen'), getMyComplaints);
router.get('/scores', protect, authorize('authority', 'admin'), getDepartmentScores);
router.get('/all', protect, authorize('authority', 'admin'), getAllComplaints);
router.get('/stats', protect, authorize('authority', 'admin'), getAuthorityStats);
router.get('/department', protect, authorize('authority', 'admin'), getDepartmentComplaints);
router.patch('/:id/status', protect, authorize('authority', 'admin'), updateComplaintStatus);
router.post('/:id/resolve', protect, authorize('authority', 'admin'), resolveComplaintWithAI);

module.exports = router;

const express = require('express');
const router = express.Router();
const { registerUser, loginUser, adminLogin, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/admin-login', adminLogin);
router.get('/me', protect, getMe);

module.exports = router;

const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, refresh, googleAuth, googleCallback, completeProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.post('/profile', protect, completeProfile);
router.post('/refresh', refresh);

module.exports = router;

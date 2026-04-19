const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, refresh } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.post('/refresh', refresh);

module.exports = router;

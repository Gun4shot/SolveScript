const express = require('express');
const router = express.Router();
const passport = require('passport');
const { logout, getMe, googleCallback } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Initiate Google OAuth login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: process.env.CLIENT_URL + '/login?error=auth_failed' }),
  googleCallback
);

// Logout
router.post('/logout', logout);

// Get current user info
router.get('/me', protect, getMe);

module.exports = router;

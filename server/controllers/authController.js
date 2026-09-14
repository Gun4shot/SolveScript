const jwt = require('jsonwebtoken');
const Joi = require('joi');
const crypto = require('crypto');
const User = require('../models/User');

// Validation schemas
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const profileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required()
});

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  settings: user.settings,
  needsProfileName: Boolean(user.needsProfileName)
});

// Generate tokens
const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30m'
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
  });
};

const tokenLifetimeMs = (token) => {
  const expiresAt = jwt.decode(token)?.exp;
  if (!expiresAt) throw new Error('Session token is missing an expiry time.');
  return Math.max(0, expiresAt * 1000 - Date.now());
};

const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieBase = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax'
  };

  res.cookie('accessToken', accessToken, {
    ...cookieBase,
    maxAge: tokenLifetimeMs(accessToken)
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieBase,
    maxAge: tokenLifetimeMs(refreshToken)
  });
};

const googleStateCookie = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth/google/callback'
});

const googleConfig = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
    const error = new Error('Google sign-in is not configured on this server.');
    error.statusCode = 503;
    throw error;
  }
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, callbackUrl: GOOGLE_CALLBACK_URL };
};

const clientUrl = () => (process.env.CLIENT_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');

const loginRedirect = (res, params = {}) => {
  const url = new URL('/login', clientUrl());
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  res.redirect(url.toString());
};

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, email, password } = value;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({ name, email, password });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    setTokenCookies(res, accessToken, refreshToken);

    // Tokens are cookie-only so client-side scripts can never read them.
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, password } = value;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
exports.logout = (req, res) => {
  res.cookie('accessToken', '', { maxAge: 0 });
  res.cookie('refreshToken', '', { maxAge: 0 });
  res.json({ message: 'Logged out successfully' });
};

// @desc    Get current user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({
    user: publicUser(req.user)
  });
};

// @desc    Start Google OAuth authorization-code flow
// @route   GET /api/auth/google
exports.googleAuth = (req, res, next) => {
  try {
    const { clientId, callbackUrl } = googleConfig();
    const state = crypto.randomBytes(32).toString('hex');
    res.cookie('googleOAuthState', state, { ...googleStateCookie(), maxAge: 10 * 60 * 1000 });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account'
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (error) {
    if (error.statusCode === 503) return loginRedirect(res, { authError: 'google_not_configured' });
    next(error);
  }
};

// @desc    Complete Google OAuth authorization-code flow
// @route   GET /api/auth/google/callback
exports.googleCallback = async (req, res, next) => {
  const cookieOptions = googleStateCookie();
  try {
    const { code, state, error: providerError } = req.query;
    const expectedState = req.cookies?.googleOAuthState;
    res.clearCookie('googleOAuthState', cookieOptions);

    if (providerError) return loginRedirect(res, { authError: 'google_cancelled' });
    if (!code || !state || !expectedState || state.length !== expectedState.length ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
      return loginRedirect(res, { authError: 'google_state' });
    }

    const { clientId, clientSecret, callbackUrl } = googleConfig();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) {
      return loginRedirect(res, { authError: 'google_exchange' });
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) {
      return loginRedirect(res, { authError: 'google_profile' });
    }

    const email = profile.email.toLowerCase().trim();
    let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] }).select('+googleId');
    let firstGoogleLogin = false;
    if (!user) {
      user = await User.create({
        googleId: profile.sub,
        email,
        name: 'Student',
        needsProfileName: true
      });
      firstGoogleLogin = true;
    } else if (!user.googleId) {
      user.googleId = profile.sub;
      await user.save();
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    setTokenCookies(res, accessToken, refreshToken);
    return loginRedirect(res, { google: firstGoogleLogin || user.needsProfileName ? 'profile' : 'success' });
  } catch (error) {
    next(error);
  }
};

// @desc    Set a first-time Google user's display name
// @route   POST /api/auth/profile
exports.completeProfile = async (req, res, next) => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    req.user.name = value.name;
    req.user.needsProfileName = false;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    setTokenCookies(res, newAccessToken, newRefreshToken);

    res.json({ user: publicUser(user) });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

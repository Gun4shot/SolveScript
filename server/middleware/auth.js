const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;
    
    if (!token) {
      // Also check Authorization header for API clients
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      // Browsers can remove an expired access-token cookie before this request
      // reaches the server. Tell the client to use its still-valid refresh cookie
      // instead of treating that normal expiry as a logout.
      return res.status(401).json({
        message: 'Not authorized, no token',
        expired: Boolean(req.cookies?.refreshToken)
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', expired: true });
    }
    return res.status(401).json({ message: 'Not authorized' });
  }
};

// Optional auth - sets req.user if token present, but doesn't block
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    }
  } catch {
    // Silently continue without user
  }
  next();
};

module.exports = { protect, optionalAuth };

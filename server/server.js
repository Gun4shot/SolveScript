const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });
const insecureSecrets = [process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET].some((secret) => (
  !secret || secret.length < 32 || /replace-with|change-me|example/i.test(secret)
));
if (process.env.NODE_ENV === 'production' && (insecureSecrets || process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET)) {
  throw new Error('Production requires distinct JWT_SECRET and JWT_REFRESH_SECRET values of at least 32 characters.');
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { connectDB, isDatabaseReady } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const paperRoutes = require('./routes/papers');
const attemptRoutes = require('./routes/attempts');
const libraryRoutes = require('./routes/library');
const writtenLibraryRoutes = require('./routes/writtenLibrary');
const writtenAttemptRoutes = require('./routes/writtenAttempts');

const app = express();
// Trust only the configured number of reverse-proxy hops, never every client.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0) app.set('trust proxy', proxyHops);
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
].filter(Boolean);

// Connect to database
connectDB();

const requireDatabase = (req, res, next) => {
  if (isDatabaseReady()) {
    next();
    return;
  }

  res.status(503).json({
    message: 'Paper service is reconnecting to the database. Please try again shortly.',
  });
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 20 : 100)),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Robots-Tag', 'noindex');
  next();
});

// Routes
app.use('/api/auth', requireDatabase, authLimiter, authRoutes);
app.use('/api/papers', requireDatabase, paperRoutes);
app.use('/api/attempts', requireDatabase, attemptRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/written-library', writtenLibraryRoutes);
app.use('/api/written-attempts', requireDatabase, writtenAttemptRoutes);

// Health check
// Process liveness is separate from database readiness so a DB interruption
// doesn't cause a hosting platform to repeatedly restart a healthy process.
app.get('/api/live', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (req, res) => {
  res.status(isDatabaseReady() ? 200 : 503).json({
    status: isDatabaseReady() ? 'ok' : 'database_unavailable',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const {
  createAttempt,
  getProgress,
  getAttempts,
  getAttempt,
  updateAttempt,
  deleteAttempt,
  requestAiReview,
  savePage,
} = require('../controllers/writtenAttemptController');

const router = express.Router();
const aiReviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI review is limited to five requests per hour. Please try again later.' },
});

router.use(protect);
router.post('/', createAttempt);
router.get('/progress', getProgress);
router.get('/', getAttempts);
router.get('/:id', getAttempt);
router.patch('/:id', updateAttempt);
router.delete('/:id', deleteAttempt);
router.post('/:id/ai-review', aiReviewLimiter, requestAiReview);
router.put('/:id/pages/:pageNumber', savePage);

module.exports = router;

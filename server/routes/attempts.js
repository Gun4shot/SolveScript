const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  submitAttempt,
  getAttempts,
  getAttempt,
  updateAnnotations,
  getStats
} = require('../controllers/attemptController');

router.post('/', protect, submitAttempt);
router.get('/stats', protect, getStats);
router.get('/', protect, getAttempts);
router.get('/:id', protect, getAttempt);
router.put('/:id/annotations', protect, updateAnnotations);

module.exports = router;

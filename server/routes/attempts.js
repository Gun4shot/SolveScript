const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  submitAttempt,
  getDraft,
  getDrafts,
  deleteDraft,
  saveDraft,
  getAttempts,
  getAttempt,
  updateAnnotations,
  getStats
} = require('../controllers/attemptController');

router.post('/', protect, submitAttempt);
router.get('/drafts', protect, getDraft);
router.get('/drafts/all', protect, getDrafts);
router.delete('/drafts/:id', protect, deleteDraft);
router.put('/drafts', protect, saveDraft);
router.get('/stats', protect, getStats);
router.get('/', protect, getAttempts);
router.get('/:id', protect, getAttempt);
router.put('/:id/annotations', protect, updateAnnotations);

module.exports = router;

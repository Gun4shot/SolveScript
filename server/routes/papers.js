const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadPaper,
  updateAnswers,
  getPapers,
  getPaper,
  getPaperPDF,
  deletePaper
} = require('../controllers/paperController');

router.post('/upload', protect, upload.fields([
  { name: 'questionPaper', maxCount: 1 },
  { name: 'markingScheme', maxCount: 1 }
]), uploadPaper);

router.put('/:id/answers', protect, updateAnswers);
router.get('/', protect, getPapers);
router.get('/:id', protect, getPaper);
router.get('/:id/pdf/:type', protect, getPaperPDF);
router.delete('/:id', protect, deletePaper);

module.exports = router;

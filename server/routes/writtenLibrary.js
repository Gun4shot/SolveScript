const express = require('express');
const {
  getWrittenPapers,
  getWrittenPaperFolders,
  getWrittenPaper,
  getWrittenPaperPDF,
} = require('../controllers/writtenLibraryController');

const router = express.Router();

router.get('/folders', getWrittenPaperFolders);
router.get('/', getWrittenPapers);
router.get('/:id/pdf/:type', getWrittenPaperPDF);
router.get('/:id', getWrittenPaper);

module.exports = router;

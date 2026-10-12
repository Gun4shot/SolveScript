const express = require('express');
const router = express.Router();
const {
  getLibraryPapers,
  getLibraryCatalog,
  getLibraryPaper,
  getLibraryPDF,
  getLibraryQuestionCropImage,
  getLibraryQuestionCrops
} = require('../controllers/libraryController');

router.get('/', getLibraryPapers);
router.get('/catalog', getLibraryCatalog);
router.get('/:id/crops', getLibraryQuestionCrops);
router.get('/:id/crops/:question/image', getLibraryQuestionCropImage);
router.get('/:id', getLibraryPaper);
router.get('/:id/pdf/:type', getLibraryPDF);

module.exports = router;

const Paper = require('../models/Paper');
const { parseMarkingScheme } = require('../services/markingSchemeParser');
const { extractQuestions, calculateConfidence } = require('../services/questionExtractor');
const pdf = require('pdf-parse');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// @desc    Upload paper and marking scheme, parse answers
// @route   POST /api/papers/upload
exports.uploadPaper = async (req, res, next) => {
  try {
    if (!req.files || !req.files.questionPaper || !req.files.markingScheme) {
      return res.status(400).json({ message: 'Both question paper and marking scheme PDFs are required' });
    }

    const questionPaperFile = req.files.questionPaper[0];
    const markingSchemeFile = req.files.markingScheme[0];

    // Read marking scheme for answers
    // Step 1: Determine PDF Type
    const qpBuffer = fs.readFileSync(questionPaperFile.path);
    const qpData = await pdf(qpBuffer);
    const pageCount = qpData.numpages || 1;
    const isDigital = qpData.text.length > (100 * pageCount);

    let extractedQuestions = [];
    if (isDigital) {
      // Step 2A: Digital PDF Path
      extractedQuestions = extractQuestions(qpData.text);
    } else {
      // Step 2B: Scanned PDF Path (OCR)
      console.log('Scanned PDF detected. OCR path Step 2B starting...');
      // Best effort extraction for now, or trigger OCR
      extractedQuestions = extractQuestions(qpData.text);
    }

    const qpConfidence = calculateConfidence(extractedQuestions);

    // Read marking scheme for answers (Step 4)
    const msBuffer = fs.readFileSync(markingSchemeFile.path);
    const msResult = await parseMarkingScheme(msBuffer, extractedQuestions.length);

    let finalAnswers = msResult.answers;
    // Overwrite with frontend answers if provided (and valid)
    if (req.body.answers) {
      try {
        const providedAnswers = JSON.parse(req.body.answers);
        if (Object.keys(providedAnswers).length > 0) {
          finalAnswers = providedAnswers;
        }
      } catch (e) {
        console.error('Error parsing frontend answers:', e);
      }
    }

    // Create paper record (Step 6: Store and Proceed)
    const paper = await Paper.create({
      userId: req.user._id,
      title: req.body.title || 'Untitled Paper',
      subject: req.body.subject || '',
      level: req.body.level || '',
      session: req.body.session || '',
      year: req.body.year || '',
      variant: req.body.variant || '',
      questionPaperPath: questionPaperFile.path,
      markingSchemePath: markingSchemeFile.path,
      answers: finalAnswers,
      extractedQuestions: extractedQuestions,
      extractionConfidence: qpConfidence,
      totalQuestions: Object.keys(finalAnswers).length || 40
    });

    res.status(201).json({
      paper: {
        id: paper._id,
        title: paper.title,
        subject: paper.subject,
        level: paper.level,
        session: paper.session,
        year: paper.year,
        variant: paper.variant,
        totalQuestions: paper.totalQuestions,
        answers: Object.fromEntries(paper.answers),
        extractedQuestions: paper.extractedQuestions,
        extractionConfidence: paper.extractionConfidence
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update paper answers (manual correction)
// @route   PUT /api/papers/:id/answers
exports.updateAnswers = async (req, res, next) => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user._id });
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ message: 'Answers object is required' });
    }

    // Validate answers
    for (const [q, a] of Object.entries(answers)) {
      const qNum = parseInt(q);
      if (isNaN(qNum) || qNum < 1 || qNum > 100) continue; // Skip invalid indices
      
      const normalizedAns = a ? a.toUpperCase() : null;
      if (normalizedAns && !['A', 'B', 'C', 'D'].includes(normalizedAns)) {
        return res.status(400).json({ message: `Invalid answer for question ${q}: ${a}` });
      }
    }

    paper.answers = answers;
    await paper.save();

    res.json({
      paper: {
        id: paper._id,
        title: paper.title,
        answers: Object.fromEntries(paper.answers)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's papers
// @route   GET /api/papers
exports.getPapers = async (req, res, next) => {
  try {
    const papers = await Paper.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-questionPaperPath -markingSchemePath');

    res.json({ papers: papers.map(p => ({
      id: p._id,
      title: p.title,
      subject: p.subject,
      level: p.level,
      session: p.session,
      year: p.year,
      variant: p.variant,
      totalQuestions: p.totalQuestions,
      extractionConfidence: p.extractionConfidence,
      createdAt: p.createdAt
    }))});
  } catch (error) {
    next(error);
  }
};

// @desc    Get single paper
// @route   GET /api/papers/:id
exports.getPaper = async (req, res, next) => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user._id });
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    res.json({
      paper: {
        id: paper._id,
        title: paper.title,
        subject: paper.subject,
        level: paper.level,
        session: paper.session,
        year: paper.year,
        variant: paper.variant,
        totalQuestions: paper.totalQuestions,
        answers: Object.fromEntries(paper.answers),
        extractedQuestions: paper.extractedQuestions,
        extractionConfidence: paper.extractionConfidence,
        createdAt: paper.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const path = require('path');

// @desc    Serve paper PDF file (Redirects to Cloudinary URL or serves local file)
// @route   GET /api/papers/:id/pdf/:type
exports.getPaperPDF = async (req, res, next) => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user._id });
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const filePath = req.params.type === 'question' 
      ? paper.questionPaperPath 
      : paper.markingSchemePath;

    if (!filePath) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if it's a Cloudinary URL or local path
    if (filePath.startsWith('http')) {
      return res.redirect(filePath);
    } else {
      // It's a local path
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      } else {
        return res.status(404).json({ message: 'Local file not found' });
      }
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete paper
// @route   DELETE /api/papers/:id
exports.deletePaper = async (req, res, next) => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user._id });
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    // Delete files from Cloudinary or local storage
    try {
      const deleteFile = async (filePath) => {
        if (!filePath) return;
        if (filePath.startsWith('http')) {
          // Cloudinary deletion
          const parts = filePath.split('/');
          const filename = parts[parts.length - 1];
          const publicId = 'papersolve/' + filename.split('.')[0];
          await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        } else if (fs.existsSync(filePath)) {
          // Local deletion
          fs.unlinkSync(filePath);
        }
      };

      await deleteFile(paper.questionPaperPath);
      await deleteFile(paper.markingSchemePath);
    } catch (e) {
      console.error('Error deleting files:', e.message);
    }

    await paper.deleteOne();
    res.json({ message: 'Paper deleted successfully' });
  } catch (error) {
    next(error);
  }
};

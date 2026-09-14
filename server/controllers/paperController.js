const Paper = require('../models/Paper');
const { parseMarkingScheme } = require('../services/markingSchemeParser');
const { ensureQuestionCrops, getCropFile, toCropDTO } = require('../services/questionCropper');
const path = require('path');
const fs = require('fs');

async function hasPdfSignature(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(5);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return bytesRead === 5 && buffer.toString('ascii') === '%PDF-';
  } finally {
    await handle.close();
  }
}

async function removeFiles(files) {
  await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
}

// @desc    Upload paper and marking scheme, parse answers
// @route   POST /api/papers/upload
exports.uploadPaper = async (req, res, next) => {
  try {
    if (!req.files || !req.files.questionPaper || !req.files.markingScheme) {
      return res.status(400).json({ message: 'Both question paper and marking scheme PDFs are required' });
    }

    const questionPaperFile = req.files.questionPaper[0];
    const markingSchemeFile = req.files.markingScheme[0];

    // MIME types are supplied by the browser and can be forged. Check the
    // signature after upload, then discard invalid files before parsing them.
    const validFiles = await Promise.all([
      hasPdfSignature(questionPaperFile.path),
      hasPdfSignature(markingSchemeFile.path),
    ]);
    if (!validFiles.every(Boolean)) {
      await removeFiles([questionPaperFile, markingSchemeFile]);
      return res.status(400).json({ message: 'Both uploads must be valid PDF files.' });
    }

    // Parse marking scheme
    const parseResult = await parseMarkingScheme(markingSchemeFile.path);

    // Create paper record
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
      answers: parseResult.answers,
      totalQuestions: 40
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
        answers: Object.fromEntries(paper.answers)
      },
      parsing: {
        confidence: parseResult.confidence,
        totalFound: parseResult.totalFound,
        strategy: parseResult.strategy
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
      if (qNum < 1 || qNum > 40 || !['A', 'B', 'C', 'D'].includes(a.toUpperCase())) {
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
        createdAt: paper.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Serve paper PDF file
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

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    next(error);
  }
};

// @desc    Generate and return focused question crops for a saved paper
// @route   GET /api/papers/:id/crops
exports.getPaperQuestionCrops = async (req, res, next) => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user._id });
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const manifest = await ensureQuestionCrops(paper);
    if (!manifest) {
      return res.status(500).json({ message: 'Question crops could not be generated' });
    }

    res.json(toCropDTO(paper._id, manifest, 'papers'));
  } catch (error) {
    next(error);
  }
};

// @desc    Serve one focused question crop for a saved paper
// @route   GET /api/papers/:id/crops/:question/image
exports.getPaperQuestionCropImage = async (req, res, next) => {
  try {
    const questionNumber = Number(req.params.question);
    if (!Number.isInteger(questionNumber) || questionNumber < 1) {
      return res.status(400).json({ message: 'Invalid question number' });
    }

    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user._id });
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const manifest = await ensureQuestionCrops(paper);
    const filePath = getCropFile(manifest, questionNumber);
    if (!filePath) {
      return res.status(404).json({ message: 'Question crop not found' });
    }

    res.sendFile(path.resolve(filePath));
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

    // Delete files
    try {
      if (fs.existsSync(paper.questionPaperPath)) fs.unlinkSync(paper.questionPaperPath);
      if (fs.existsSync(paper.markingSchemePath)) fs.unlinkSync(paper.markingSchemePath);
    } catch (e) {
      console.error('Error deleting files:', e.message);
    }

    await paper.deleteOne();
    res.json({ message: 'Paper deleted successfully' });
  } catch (error) {
    next(error);
  }
};

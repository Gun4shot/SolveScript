const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const PaperLibrary = require('../models/PaperLibrary');
const { isDatabaseReady } = require('../config/db');
const { getLocalPapers, getLocalPaper } = require('../services/localPaperLibrary');
const { ensureQuestionCrops, getCropFile, toCropDTO } = require('../services/questionCropper');
const findPaper = (id) => {
  const normalizedId = String(id);
  if (normalizedId.startsWith('local-')) return getLocalPaper(normalizedId);
  if (!mongoose.isValidObjectId(normalizedId) || !isDatabaseReady()) return null;
  return PaperLibrary.findOne({ _id: normalizedId, status: 'ready' });
};

function toPaperDTO(paper, includeAnswers = false) {
  const dto = {
    id: paper._id,
    examBoard: paper.examBoard,
    qualification: paper.qualification,
    syllabusCode: paper.syllabusCode,
    subject: paper.subject,
    year: paper.year,
    session: paper.session,
    sessionCode: paper.sessionCode,
    component: paper.component,
    paperNumber: paper.paperNumber,
    paperType: paper.paperType,
    title: paper.title,
    totalQuestions: paper.totalQuestions,
    discountedQuestions: paper.discountedQuestions || [],
    componentThreshold: paper.componentThreshold || null,
    difficulty: paper.difficulty || paper.componentThreshold?.difficulty || 'unknown',
    status: paper.status
  };

  if (includeAnswers) {
    dto.answers = Object.fromEntries(paper.answers || []);
  }

  return dto;
}

exports.getLibraryPapers = async (req, res, next) => {
  try {
    const { subject, syllabusCode, year, sessionCode, difficulty } = req.query;
    if (!isDatabaseReady()) {
      const papers = (await getLocalPapers()).filter((paper) => (!subject || paper.subject === subject) && (!syllabusCode || paper.syllabusCode === syllabusCode) && (!year || paper.year === Number(year)) && (!sessionCode || paper.sessionCode === sessionCode) && (!difficulty || (paper.difficulty || 'unknown') === difficulty));
      return res.json({ papers: papers.map((paper) => toPaperDTO(paper)), source: 'local' });
    }
    const query = { status: 'ready' };

    if (subject) query.subject = subject;
    if (syllabusCode) query.syllabusCode = syllabusCode;
    if (year) query.year = Number(year);
    if (sessionCode) query.sessionCode = sessionCode;
    if (difficulty) query.difficulty = difficulty;

    const papers = await PaperLibrary.find(query)
      .sort({ subject: 1, year: -1, sessionCode: 1, component: 1 })
      .select('-questionPaperPath -markingSchemePath -answers')
      .lean();

    res.json({ papers: papers.map((paper) => toPaperDTO(paper)) });
  } catch (error) {
    next(error);
  }
};

exports.getLibraryPaper = async (req, res, next) => {
  try {
    const paper = await findPaper(req.params.id);
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    res.json({ paper: toPaperDTO(paper, true) });
  } catch (error) {
    next(error);
  }
};

exports.getLibraryPDF = async (req, res, next) => {
  try {
    const paper = await findPaper(req.params.id);
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const filePath = req.params.type === 'mark-scheme'
      ? paper.markingSchemePath
      : paper.questionPaperPath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    next(error);
  }
};

exports.getLibraryQuestionCrops = async (req, res, next) => {
  try {
    const paper = await findPaper(req.params.id);
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const manifest = await ensureQuestionCrops(paper);
    if (!manifest) {
      return res.status(500).json({ message: 'Question crops could not be generated' });
    }

    res.json(toCropDTO(paper._id, manifest));
  } catch (error) {
    next(error);
  }
};

exports.getLibraryQuestionCropImage = async (req, res, next) => {
  try {
    const questionNumber = Number(req.params.question);
    if (!Number.isInteger(questionNumber) || questionNumber < 1) {
      return res.status(400).json({ message: 'Invalid question number' });
    }

    const paper = await findPaper(req.params.id);
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

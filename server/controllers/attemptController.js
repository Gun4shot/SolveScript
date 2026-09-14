const Attempt = require('../models/Attempt');
const Paper = require('../models/Paper');
const PaperLibrary = require('../models/PaperLibrary');

const toPaperDTO = (paper) => paper ? {
  id: paper._id,
  title: paper.title,
  subject: paper.subject,
  level: paper.level || paper.qualification,
  session: paper.session,
  year: paper.year,
  variant: paper.variant || paper.component
} : null;

async function findOwnedPaper(paperId, source, userId) {
  return source === 'library'
    ? PaperLibrary.findById(paperId)
    : Paper.findOne({ _id: paperId, userId });
}

function draftPayload(attempt) {
  return {
    id: attempt._id,
    paperId: attempt.paperId || attempt.libraryPaperId,
    mode: attempt.mode,
    draft: attempt.draft || {},
    annotations: attempt.annotations || {},
    roughPageData: attempt.roughPageData || {},
    updatedAt: attempt.updatedAt,
  };
}

function normalizeDraft(body) {
  const draft = body?.draft;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const fields = ['selectedAnswers', 'flaggedQuestions', 'currentQuestion', 'currentPage', 'config', 'timeRemaining', 'elapsed', 'questionTimes'];
  return fields.reduce((value, field) => {
    if (draft[field] !== undefined) value[field] = draft[field];
    return value;
  }, {});
}

exports.getDraft = async (req, res, next) => {
  try {
    const { paperId, source = 'upload' } = req.query;
    if (!paperId || !['library', 'upload'].includes(source)) return res.status(400).json({ message: 'Paper and source are required' });
    const filter = { userId: req.user._id, status: 'draft', [source === 'library' ? 'libraryPaperId' : 'paperId']: paperId };
    const attempt = await Attempt.findOne(filter).sort({ updatedAt: -1 });
    res.json({ attempt: attempt ? draftPayload(attempt) : null });
  } catch (error) {
    next(error);
  }
};

exports.saveDraft = async (req, res, next) => {
  try {
    const { id, paperId, source = 'upload', mode, annotations, roughPageData } = req.body;
    const draft = normalizeDraft(req.body);
    if (!paperId || !['library', 'upload'].includes(source) || !['exam', 'casual'].includes(mode) || !draft) {
      return res.status(400).json({ message: 'The saved-paper data is invalid' });
    }
    if (JSON.stringify(draft).length > 500000 || JSON.stringify(annotations || {}).length > 8000000) {
      return res.status(413).json({ message: 'This saved paper is too large to store' });
    }
    const paper = await findOwnedPaper(paperId, source, req.user._id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    let attempt = id ? await Attempt.findOne({ _id: id, userId: req.user._id, status: 'draft' }) : null;
    if (!attempt) {
      attempt = await Attempt.findOne({ userId: req.user._id, status: 'draft', [source === 'library' ? 'libraryPaperId' : 'paperId']: paperId }).sort({ updatedAt: -1 });
    }
    if (!attempt) {
      attempt = new Attempt({
        userId: req.user._id,
        paperId: source === 'library' ? undefined : paperId,
        libraryPaperId: source === 'library' ? paperId : undefined,
        mode,
        status: 'draft',
        answers: {},
      });
    }
    attempt.mode = mode;
    attempt.status = 'draft';
    attempt.draft = draft;
    if (annotations && typeof annotations === 'object' && !Array.isArray(annotations)) attempt.annotations = annotations;
    if (roughPageData && typeof roughPageData === 'object' && !Array.isArray(roughPageData)) attempt.roughPageData = roughPageData;
    await attempt.save();
    res.json({ attempt: draftPayload(attempt) });
  } catch (error) {
    next(error);
  }
};

exports.getDrafts = async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ userId: req.user._id, status: 'draft' })
      .sort({ updatedAt: -1 })
      .populate('paperId', 'title subject level session year')
      .populate('libraryPaperId', 'title subject qualification session year component');
    res.json({ attempts: attempts.map((attempt) => ({
      ...draftPayload(attempt),
      source: attempt.libraryPaperId ? 'library' : 'upload',
      paper: toPaperDTO(attempt.paperId || attempt.libraryPaperId),
    })) });
  } catch (error) {
    next(error);
  }
};

exports.deleteDraft = async (req, res, next) => {
  try {
    const attempt = await Attempt.findOneAndDelete({ _id: req.params.id, userId: req.user._id, status: 'draft' });
    if (!attempt) return res.status(404).json({ message: 'Saved paper not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// @desc    Submit an attempt
// @route   POST /api/attempts
exports.submitAttempt = async (req, res, next) => {
  try {
    const { paperId, mode, answers, totalTimeTaken, examDuration, annotations, roughPageData, source = 'upload', draftAttemptId } = req.body;
    const isLibraryPaper = source === 'library';

    const paper = await findOwnedPaper(paperId, source, req.user._id);
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const correctAnswers = Object.fromEntries(paper.answers);
    
    // Process answers and calculate stats
    const processedAnswers = {};
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;

    for (let i = 1; i <= 40; i++) {
      const userAnswer = answers[i];
      const correct = correctAnswers[i];
      const isCorrect = userAnswer && correct && userAnswer.toUpperCase() === correct.toUpperCase();
      
      if (!userAnswer) {
        totalSkipped++;
      } else if (isCorrect) {
        totalCorrect++;
      } else {
        totalWrong++;
      }

      processedAnswers[i] = {
        selected: userAnswer || null,
        correct: correct || 'N/A',
        isCorrect: !!isCorrect,
        timeSpent: (answers[i + '_time']) || 0
      };
    }

    const percentage = Math.round((totalCorrect / 40) * 100);

    const attempt = draftAttemptId
      ? await Attempt.findOne({ _id: draftAttemptId, userId: req.user._id, status: 'draft' })
      : null;
    const completed = attempt || new Attempt({
      userId: req.user._id,
      paperId: isLibraryPaper ? undefined : paperId,
      libraryPaperId: isLibraryPaper ? paperId : undefined,
    });
    if (attempt && String(attempt.paperId || attempt.libraryPaperId) !== String(paperId)) {
      return res.status(400).json({ message: 'Saved paper does not match this submission' });
    }
    completed.mode = mode;
    completed.status = 'completed';
    completed.draft = null;
    completed.answers = processedAnswers;
    completed.totalCorrect = totalCorrect;
    completed.totalWrong = totalWrong;
    completed.totalSkipped = totalSkipped;
    completed.percentage = percentage;
    completed.totalTimeTaken = totalTimeTaken || 0;
    completed.examDuration = examDuration || 0;
    completed.annotations = annotations || {};
    completed.roughPageData = roughPageData || {};
    completed.completedAt = new Date();
    await completed.save();

    res.status(201).json({
      attempt: {
        id: completed._id,
        paperId: completed.paperId || completed.libraryPaperId,
        mode: completed.mode,
        totalCorrect,
        totalWrong,
        totalSkipped,
        percentage,
        totalTimeTaken,
        answers: Object.fromEntries(completed.answers),
        completedAt: completed.completedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's attempts
// @route   GET /api/attempts
exports.getAttempts = async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ userId: req.user._id, status: { $ne: 'draft' } })
      .sort({ createdAt: -1 })
      .populate('paperId', 'title subject level session year')
      .populate('libraryPaperId', 'title subject qualification session year component')
      .select('-annotations -roughPageData -answers');

    res.json({ attempts: attempts.map(a => ({
      id: a._id,
      paper: toPaperDTO(a.paperId || a.libraryPaperId),
      mode: a.mode,
      totalCorrect: a.totalCorrect,
      totalWrong: a.totalWrong,
      totalSkipped: a.totalSkipped,
      percentage: a.percentage,
      totalTimeTaken: a.totalTimeTaken,
      completedAt: a.completedAt,
      createdAt: a.createdAt
    }))});
  } catch (error) {
    next(error);
  }
};

// @desc    Get single attempt with full details
// @route   GET /api/attempts/:id
exports.getAttempt = async (req, res, next) => {
  try {
    const attempt = await Attempt.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('paperId', 'title subject level session year variant')
      .populate('libraryPaperId', 'title subject qualification session year component');

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    res.json({
      attempt: {
        id: attempt._id,
        paper: toPaperDTO(attempt.paperId || attempt.libraryPaperId),
        mode: attempt.mode,
        answers: Object.fromEntries(attempt.answers),
        totalCorrect: attempt.totalCorrect,
        totalWrong: attempt.totalWrong,
        totalSkipped: attempt.totalSkipped,
        percentage: attempt.percentage,
        totalTimeTaken: attempt.totalTimeTaken,
        examDuration: attempt.examDuration,
        annotations: attempt.annotations,
        roughPageData: attempt.roughPageData,
        completedAt: attempt.completedAt,
        createdAt: attempt.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update attempt annotations (editing saved paper)
// @route   PUT /api/attempts/:id/annotations
exports.updateAnnotations = async (req, res, next) => {
  try {
    const attempt = await Attempt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    if (req.body.annotations) attempt.annotations = req.body.annotations;
    if (req.body.roughPageData) attempt.roughPageData = req.body.roughPageData;
    await attempt.save();

    res.json({ message: 'Annotations updated successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/attempts/stats
exports.getStats = async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ userId: req.user._id, status: { $ne: 'draft' } })
      .sort({ createdAt: -1 });

    const totalPapers = attempts.length;
    const avgScore = totalPapers > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / totalPapers)
      : 0;
    const bestScore = totalPapers > 0
      ? Math.max(...attempts.map(a => a.percentage))
      : 0;
    const totalStudyTime = attempts.reduce((sum, a) => sum + (a.totalTimeTaken || 0), 0);

    res.json({
      stats: {
        totalPapers,
        avgScore,
        bestScore,
        totalStudyTime
      }
    });
  } catch (error) {
    next(error);
  }
};

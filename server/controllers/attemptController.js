const Attempt = require('../models/Attempt');
const Paper = require('../models/Paper');

// @desc    Start or resume an attempt
// @route   POST /api/attempts/start
exports.startAttempt = async (req, res, next) => {
  try {
    const { paperId, mode, timeLimit } = req.body;

    let attempt = await Attempt.findOne({ 
      userId: req.user._id, 
      paperId, 
      isCompleted: false 
    });

    if (!attempt) {
      attempt = await Attempt.create({
        userId: req.user._id,
        paperId,
        mode,
        timeLimit: mode === 'exam' ? timeLimit : 0,
        startedAt: new Date(),
        answers: {}
      });
    }

    // Calculate remaining time for exam mode
    let remainingTime = 0;
    if (attempt.mode === 'exam') {
      const elapsed = Math.floor((new Date() - attempt.startedAt) / 1000);
      remainingTime = Math.max(0, attempt.timeLimit - elapsed);
    }

    res.json({ attempt, remainingTime });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit an attempt
// @route   POST /api/attempts/submit
exports.submitAttempt = async (req, res, next) => {
  try {
    const { paperId, mode, answers, totalTimeTaken, examDuration, annotations, roughPageData } = req.body;

    const paper = await Paper.findOne({ _id: paperId, userId: req.user._id });
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const correctAnswers = Object.fromEntries(paper.answers);
    const numQuestions = paper.totalQuestions || Object.keys(correctAnswers).length || 40;
    
    // Process answers and calculate stats
    const processedAnswers = {};
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;

    for (let i = 1; i <= numQuestions; i++) {
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

    const percentage = numQuestions > 0 ? Math.round((totalCorrect / numQuestions) * 100) : 0;

    const attempt = await Attempt.findOneAndUpdate(
      { userId: req.user._id, paperId, isCompleted: false },
      {
        answers: processedAnswers,
        totalCorrect,
        totalWrong,
        totalSkipped,
        percentage,
        totalTimeTaken: totalTimeTaken || 0,
        examDuration: examDuration || 0,
        annotations: annotations || {},
        roughPageData: roughPageData || {},
        completedAt: new Date(),
        isCompleted: true
      },
      { new: true, upsert: true }
    );

    res.status(201).json({
      attempt: {
        id: attempt._id,
        paperId: attempt.paperId,
        mode: attempt.mode,
        totalCorrect,
        totalWrong,
        totalSkipped,
        percentage,
        totalTimeTaken,
        answers: Object.fromEntries(attempt.answers),
        completedAt: attempt.completedAt
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
    const attempts = await Attempt.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('paperId', 'title subject level session year')
      .select('-annotations -roughPageData -answers');

    res.json({ attempts: attempts.map(a => ({
      id: a._id,
      paper: a.paperId ? {
        id: a.paperId._id,
        title: a.paperId.title,
        subject: a.paperId.subject,
        level: a.paperId.level,
        session: a.paperId.session,
        year: a.paperId.year
      } : null,
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
      .populate('paperId', 'title subject level session year variant');

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    res.json({
      attempt: {
        id: attempt._id,
        paper: attempt.paperId ? {
          id: attempt.paperId._id,
          title: attempt.paperId.title,
          subject: attempt.paperId.subject,
          level: attempt.paperId.level,
          session: attempt.paperId.session,
          year: attempt.paperId.year,
          variant: attempt.paperId.variant
        } : null,
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
    const attempts = await Attempt.find({ userId: req.user._id })
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

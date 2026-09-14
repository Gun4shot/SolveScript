const WrittenAttempt = require('../models/WrittenAttempt');
const WrittenAttemptPage = require('../models/WrittenAttemptPage');
const Attempt = require('../models/Attempt');
const { findWrittenPaper } = require('./writtenLibraryController');
const { expectedPaperNumbers } = require('../config/writtenPaperSpecs');
const { readAsset } = require('../services/writtenPaperAssetStore');

const MODES = new Set(['casual', 'exam', 'custom']);
const STATUSES = new Set(['submitted']);
// Flash is available on this project's tested free-tier key and keeps review
// requests practical for students. The result remains an estimate, not marking.
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const MAX_MARK_SCHEME_BYTES = 12 * 1024 * 1024;

function serializeAttempt(attempt, pages = undefined) {
  const value = attempt.toObject ? attempt.toObject() : attempt;
  const result = {
    id: String(value._id),
    paper: value.paper,
    mode: value.mode,
    durationMinutes: value.durationMinutes,
    status: value.status,
    countsTowardProgress: Boolean(value.countsTowardProgress),
    startedAt: value.startedAt,
    deadlineAt: value.deadlineAt,
    pausedSeconds: value.pausedSeconds,
    elapsedSeconds: value.elapsedSeconds,
    currentPage: value.currentPage,
    flags: value.flags || [],
    selfMark: value.selfMark || null,
    aiReview: value.aiReview || null,
    submittedAt: value.submittedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  if (pages !== undefined) {
    result.pages = pages.map((page) => ({
      pageNumber: page.pageNumber,
      annotation: page.annotation || {},
      revision: page.revision,
      updatedAt: page.updatedAt,
    }));
  }
  return result;
}

async function ownedAttempt(id, userId) {
  return WrittenAttempt.findOne({ _id: id, userId });
}

exports.createAttempt = async (req, res, next) => {
  try {
    const { paperId, mode = 'casual', durationMinutes } = req.body;
    if (!paperId || !MODES.has(mode)) {
      return res.status(400).json({ message: 'A valid paper and session mode are required' });
    }

    const paper = await findWrittenPaper(String(paperId));
    if (!paper) return res.status(404).json({ message: 'Written paper not found' });
    const minutes = durationMinutes === undefined ? paper.durationMinutes : Number(durationMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 360) {
      return res.status(400).json({ message: 'Duration must be a whole number from 1 to 360 minutes' });
    }

    const now = new Date();
    const attempt = await WrittenAttempt.create({
      userId: req.user._id,
      paper: {
        source: String(paper._id).startsWith('local-written-') ? 'local' : 'library',
        paperId: String(paper._id),
        title: paper.title,
        subject: paper.subject,
        syllabusCode: paper.syllabusCode,
        year: paper.year,
        sessionCode: paper.sessionCode,
        component: paper.component,
        paperNumber: paper.paperNumber,
        durationMinutes: paper.durationMinutes,
        totalMarks: paper.totalMarks,
        componentThreshold: paper.componentThreshold || null,
      },
      mode,
      durationMinutes: minutes,
      startedAt: now,
      deadlineAt: mode === 'exam' ? new Date(now.getTime() + minutes * 60_000) : null,
    });
    res.status(201).json({ attempt: serializeAttempt(attempt) });
  } catch (error) {
    next(error);
  }
};

async function getPaperAsset(paper, role) {
  const asset = (paper.assets || []).find((item) => item.role === role);
  return readAsset(asset, MAX_MARK_SCHEME_BYTES);
}

function annotatedImageParts(pages) {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 40) return null;
  const seenPages = new Set();
  let totalBytes = 0;
  const result = [];
  for (const page of pages) {
    if (!Number.isInteger(page?.pageNumber) || page.pageNumber < 1 || seenPages.has(page.pageNumber)) return null;
    if (typeof page.jpegBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(page.jpegBase64)) return null;
    const data = Buffer.from(page.jpegBase64, 'base64');
    if (!data.length || data.length > 1024 * 1024 || data[0] !== 0xff || data[1] !== 0xd8) return null;
    totalBytes += data.length;
    if (totalBytes > MAX_IMAGE_BYTES) return null;
    seenPages.add(page.pageNumber);
    result.push({ pageNumber: page.pageNumber, data: page.jpegBase64 });
  }
  return result.sort((left, right) => left.pageNumber - right.pageNumber);
}

function normalizeAiReview(text, totalMarks) {
  const candidate = text.trim().replace(/^```json\s*|\s*```$/g, '');
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  const totalAwarded = Number(parsed.totalAwarded);
  if (!Number.isFinite(totalAwarded) || totalAwarded < 0 || totalAwarded > totalMarks) return null;
  const confidence = ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low';
  const questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 100).flatMap((question) => {
    const awarded = Number(question?.awarded);
    const available = Number(question?.available);
    if (!Number.isFinite(awarded) || !Number.isFinite(available) || awarded < 0 || available < 0 || awarded > available) return [];
    return [{
      question: String(question.question || 'Unlabelled question').slice(0, 80),
      awarded,
      available,
      rationale: String(question.rationale || '').slice(0, 2000),
      confidence: ['low', 'medium', 'high'].includes(question.confidence) ? question.confidence : 'low',
    }];
  }) : [];
  return {
    provider: 'gemini',
    model: GEMINI_MODEL,
    totalAwarded,
    maxMarks: totalMarks,
    confidence,
    summary: String(parsed.summary || 'AI review completed. Check each allocation against the official scheme.').slice(0, 4000),
    questions,
    reviewedAt: new Date(),
  };
}

async function requestGeminiReview(apiKey, attempt, questionPaper, markScheme, annotatedPages) {
  const prompt = `You are assisting a student with self-marking a CAIE A-Level past paper. You receive the original question paper PDF, the official marking scheme PDF, and only those flattened page images on which the student wrote. Assess the student's handwriting against the official scheme. Pages without a supplied handwritten image should receive no credit unless the answer is visible elsewhere. Be conservative: unclear handwriting, missing working, or ambiguous answers should receive low confidence rather than invented credit. This is an educational estimate, never an official examiner result. Return JSON only with this exact shape: {"totalAwarded": number, "confidence": "low"|"medium"|"high", "summary": string, "questions": [{"question": string, "awarded": number, "available": number, "rationale": string, "confidence": "low"|"medium"|"high"}]}. The paper total is ${attempt.paper.totalMarks}. Do not award more than that total. Include only questions you can identify from the work and marking scheme.`;
  const parts = [{ text: prompt }];
  parts.push({ text: 'Original question paper PDF.' });
  parts.push({ inlineData: { mimeType: 'application/pdf', data: questionPaper.toString('base64') } });
  for (const page of annotatedPages) {
    parts.push({ text: `Annotated question-paper page ${page.pageNumber}.` });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: page.data } });
  }
  parts.push({ text: 'Official marking scheme PDF.' });
  parts.push({ inlineData: { mimeType: 'application/pdf', data: markScheme.toString('base64') } });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 12000 },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerStatus = String(payload.error?.status || 'unknown');
      console.error(`Gemini review failed: HTTP ${response.status} (${providerStatus})`);
      let message = 'Gemini could not complete this review. Please try again.';
      if (response.status === 400) message = 'Gemini rejected this document request. Reload the review page and try again.';
      if (response.status === 401 || response.status === 403) message = 'Gemini rejected this API key or its access to Gemini Flash.';
      if (response.status === 429) message = 'Gemini free-tier limit reached. Try again later.';
      if (response.status >= 500) message = 'Gemini is temporarily unavailable. Try again shortly.';
      const error = new Error(message);
      error.statusCode = response.status === 429 ? 429 : 502;
      throw error;
    }
    const text = (payload.candidates || []).flatMap((candidate) => candidate.content?.parts || []).map((part) => part.text || '').join('');
    const review = normalizeAiReview(text, attempt.paper.totalMarks);
    if (!review) {
      const error = new Error('Gemini returned an unusable review. Please try again.');
      error.statusCode = 422;
      throw error;
    }
    return review;
  } finally {
    clearTimeout(timeout);
  }
}

exports.getAttempts = async (req, res, next) => {
  try {
    const attempts = await WrittenAttempt.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select('-selfMark.notes');
    res.json({ attempts: attempts.map((attempt) => serializeAttempt(attempt)) });
  } catch (error) {
    next(error);
  }
};

exports.getProgress = async (req, res, next) => {
  try {
    const [writtenAttempts, mcqAttempts] = await Promise.all([
      WrittenAttempt.find({ userId: req.user._id, status: { $in: ['submitted', 'self_marked', 'ai_reviewed'] } }).lean(),
      Attempt.find({ userId: req.user._id, libraryPaperId: { $exists: true }, status: { $ne: 'draft' } })
        .populate('libraryPaperId', 'title subject syllabusCode year session sessionCode component paperNumber totalQuestions')
        .lean(),
    ]);
    const groups = new Map();
    const addAttempt = (entry) => {
      const suffix = String(entry.component || '').slice(-1);
      if (!entry.syllabusCode || !entry.year || !entry.sessionCode || !suffix) return;
      const key = `${entry.syllabusCode}:${entry.year}:${entry.sessionCode}:${suffix}`;
      const group = groups.get(key) || {
        id: key,
        syllabusCode: entry.syllabusCode,
        subject: entry.subject,
        year: entry.year,
        session: entry.session,
        sessionCode: entry.sessionCode,
        variant: suffix,
        expectedPaperNumbers: expectedPaperNumbers(entry.syllabusCode),
        components: new Map(),
        history: [],
      };
      group.history.push(entry);
      groups.set(key, group);
    };
    for (const attempt of writtenAttempts) {
      const score = Number.isFinite(attempt.selfMark?.totalAwarded)
        ? attempt.selfMark.totalAwarded
        : attempt.aiReview?.totalAwarded;
      addAttempt({
        id: String(attempt._id),
        source: 'written',
        title: attempt.paper.title,
        syllabusCode: attempt.paper.syllabusCode,
        subject: attempt.paper.subject,
        year: attempt.paper.year,
        session: attempt.paper.sessionCode === 's' ? 'May/June' : attempt.paper.sessionCode === 'w' ? 'October/November' : 'March',
        sessionCode: attempt.paper.sessionCode,
        component: attempt.paper.component,
        paperNumber: attempt.paper.paperNumber,
        score: Number.isFinite(score) ? score : null,
        totalMarks: attempt.paper.totalMarks,
        grade: Number.isFinite(score) ? (attempt.selfMark?.markedAt ? 'self-marked' : 'AI estimate') : 'Awaiting your mark',
        isMarked: Number.isFinite(score),
        countsTowardProgress: Boolean(attempt.countsTowardProgress),
        completedAt: attempt.submittedAt || attempt.updatedAt,
        updatedAt: attempt.updatedAt,
      });
    }
    for (const attempt of mcqAttempts) {
      const paper = attempt.libraryPaperId;
      if (!paper?.syllabusCode || String(paper.paperNumber) !== '1') continue;
      addAttempt({
        id: String(attempt._id),
        source: 'mcq',
        title: paper.title,
        syllabusCode: paper.syllabusCode,
        subject: paper.subject,
        year: paper.year,
        session: paper.session,
        sessionCode: paper.sessionCode,
        component: paper.component,
        paperNumber: paper.paperNumber,
        score: attempt.totalCorrect,
        totalMarks: paper.totalQuestions || 40,
        grade: 'auto-marked',
        isMarked: true,
        countsTowardProgress: true,
        completedAt: attempt.completedAt || attempt.updatedAt,
        updatedAt: attempt.updatedAt,
      });
    }
    const progress = [...groups.values()].map((group) => {
      const history = group.history.sort((left, right) => new Date(right.completedAt || right.updatedAt) - new Date(left.completedAt || left.updatedAt));
      const components = new Map();
      for (const attempt of history) {
        const versions = history.filter((entry) => String(entry.paperNumber) === String(attempt.paperNumber));
        const explicitlySelected = versions.find((entry) => entry.countsTowardProgress);
        const automaticallySelected = versions.length === 1 && attempt.isMarked;
        const selected = explicitlySelected === attempt || (!explicitlySelected && automaticallySelected);
        attempt.countsTowardProgress = selected;
        if (selected && !components.has(attempt.paperNumber)) components.set(attempt.paperNumber, attempt);
      }
      const selectedComponents = [...components.values()].sort((left, right) => Number(left.paperNumber) - Number(right.paperNumber));
      const totalAwarded = selectedComponents.reduce((sum, component) => sum + (component.score || 0), 0);
      const totalMarks = selectedComponents.reduce((sum, component) => sum + component.totalMarks, 0);
      return {
        ...group,
        components: selectedComponents,
        history,
        completedComponents: selectedComponents.length,
        totalComponents: group.expectedPaperNumbers.length,
        isComplete: group.expectedPaperNumbers.every((number) => components.has(number)),
        totalAwarded,
        totalMarks,
        percentage: totalMarks ? Math.round((totalAwarded / totalMarks) * 100) : 0,
      };
    }).sort((left, right) => new Date(right.components[0]?.completedAt || right.history[0]?.completedAt || 0) - new Date(left.components[0]?.completedAt || left.history[0]?.completedAt || 0));
    res.json({ progress });
  } catch (error) {
    next(error);
  }
};

exports.getAttempt = async (req, res, next) => {
  try {
    const attempt = await ownedAttempt(req.params.id, req.user._id);
    if (!attempt) return res.status(404).json({ message: 'Written attempt not found' });
    const pages = await WrittenAttemptPage.find({ attemptId: attempt._id }).sort({ pageNumber: 1 }).lean();
    res.json({ attempt: serializeAttempt(attempt, pages) });
  } catch (error) {
    next(error);
  }
};

exports.updateAttempt = async (req, res, next) => {
  try {
    const attempt = await ownedAttempt(req.params.id, req.user._id);
    if (!attempt) return res.status(404).json({ message: 'Written attempt not found' });

    const { currentPage, flags, elapsedSeconds, status, selfMark, countsTowardProgress } = req.body;
    if (currentPage !== undefined) {
      if (!Number.isInteger(currentPage) || currentPage < 1) return res.status(400).json({ message: 'Current page is invalid' });
      attempt.currentPage = currentPage;
    }
    if (flags !== undefined) {
      if (!Array.isArray(flags) || flags.some((flag) => !Number.isInteger(flag) || flag < 1)) {
        return res.status(400).json({ message: 'Flags must be page numbers' });
      }
      attempt.flags = [...new Set(flags)].sort((a, b) => a - b);
    }
    if (elapsedSeconds !== undefined) {
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return res.status(400).json({ message: 'Elapsed time is invalid' });
      attempt.elapsedSeconds = Math.round(elapsedSeconds);
    }
    if (status !== undefined) {
      if (!STATUSES.has(status)) return res.status(400).json({ message: 'Attempt status is invalid' });
      if (attempt.status !== 'draft') return res.status(409).json({ message: 'This paper has already been completed' });
      attempt.status = status;
      if (status === 'submitted' && !attempt.submittedAt) attempt.submittedAt = new Date();
    }
    if (selfMark !== undefined) {
      if (!selfMark || typeof selfMark !== 'object' || Array.isArray(selfMark)) {
        return res.status(400).json({ message: 'Self-mark data is invalid' });
      }
      if (attempt.status === 'draft') return res.status(409).json({ message: 'Finish the paper before recording a self-mark' });
      if (typeof selfMark.notes === 'string' && selfMark.notes.length > 5000) {
        return res.status(400).json({ message: 'Self-mark notes are too long' });
      }
      const hasMark = selfMark.totalAwarded !== undefined && selfMark.totalAwarded !== null && selfMark.totalAwarded !== '';
      if (hasMark) {
        const totalAwarded = Number(selfMark.totalAwarded);
        if (!Number.isFinite(totalAwarded) || totalAwarded < 0 || totalAwarded > attempt.paper.totalMarks) {
          return res.status(400).json({ message: `Self-mark must be between 0 and ${attempt.paper.totalMarks}` });
        }
        attempt.selfMark = { totalAwarded, notes: selfMark.notes || '', markedAt: new Date() };
        attempt.status = 'self_marked';
        if (!attempt.submittedAt) attempt.submittedAt = new Date();
      } else {
        attempt.selfMark = { totalAwarded: null, notes: selfMark.notes || '', markedAt: null };
      }
    }
    if (countsTowardProgress !== undefined) {
      if (typeof countsTowardProgress !== 'boolean') return res.status(400).json({ message: 'Progress selection is invalid' });
      if (countsTowardProgress) {
        const score = Number.isFinite(attempt.selfMark?.totalAwarded) ? attempt.selfMark.totalAwarded : attempt.aiReview?.totalAwarded;
        if (!Number.isFinite(score)) return res.status(409).json({ message: 'Record a self-mark or AI review before selecting this version.' });
        await WrittenAttempt.updateMany({ userId: req.user._id, 'paper.paperId': attempt.paper.paperId, _id: { $ne: attempt._id } }, { $set: { countsTowardProgress: false } });
      }
      attempt.countsTowardProgress = countsTowardProgress;
    }
    await attempt.save();
    res.json({ attempt: serializeAttempt(attempt) });
  } catch (error) {
    next(error);
  }
};

exports.deleteAttempt = async (req, res, next) => {
  try {
    const attempt = await ownedAttempt(req.params.id, req.user._id);
    if (!attempt) return res.status(404).json({ message: 'Written attempt not found' });
    await WrittenAttemptPage.deleteMany({ attemptId: attempt._id });
    await attempt.deleteOne();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.requestAiReview = async (req, res, next) => {
  try {
    const { apiKey, annotatedPages } = req.body;
    if (typeof apiKey !== 'string' || !/^[A-Za-z0-9._-]{20,200}$/.test(apiKey)) {
      return res.status(400).json({ message: 'Enter a valid Gemini API key.' });
    }
    const images = annotatedImageParts(annotatedPages);
    if (!images) return res.status(413).json({ message: 'The prepared paper images are invalid or too large. Try again with fewer pages.' });

    const attempt = await ownedAttempt(req.params.id, req.user._id);
    if (!attempt) return res.status(404).json({ message: 'Written attempt not found' });
    if (attempt.status === 'draft') return res.status(409).json({ message: 'Finish the paper before requesting AI review' });

    const paper = await findWrittenPaper(attempt.paper.paperId);
    const [questionPaper, markScheme] = paper ? await Promise.all([
      getPaperAsset(paper, 'question'),
      getPaperAsset(paper, 'mark_scheme'),
    ]) : [null, null];
    if (!questionPaper || !markScheme) return res.status(404).json({ message: 'The question paper or official marking scheme is unavailable for this paper' });

    const review = await requestGeminiReview(apiKey, attempt, questionPaper, markScheme, images);
    attempt.aiReview = review;
    attempt.status = 'ai_reviewed';
    if (!attempt.submittedAt) attempt.submittedAt = new Date();
    await attempt.save();
    res.json({ review, attempt: serializeAttempt(attempt) });
  } catch (error) {
    next(error);
  }
};

exports.savePage = async (req, res, next) => {
  try {
    const pageNumber = Number(req.params.pageNumber);
    const { annotation, expectedRevision } = req.body;
    if (!Number.isInteger(pageNumber) || pageNumber < 1) return res.status(400).json({ message: 'Page number is invalid' });
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return res.status(400).json({ message: 'Expected revision is required' });
    if (!annotation || typeof annotation !== 'object' || Array.isArray(annotation)) {
      return res.status(400).json({ message: 'Annotation data is required' });
    }
    if (Buffer.byteLength(JSON.stringify(annotation)) > 5 * 1024 * 1024) {
      return res.status(413).json({ message: 'This page annotation is too large to save' });
    }

    const attempt = await ownedAttempt(req.params.id, req.user._id);
    if (!attempt) return res.status(404).json({ message: 'Written attempt not found' });
    if (attempt.status !== 'draft') return res.status(409).json({ message: 'Completed attempts cannot be edited' });

    const filter = { attemptId: attempt._id, pageNumber, revision: expectedRevision };
    const update = { $set: { annotation }, $inc: { revision: 1 } };
    let page = await WrittenAttemptPage.findOneAndUpdate(filter, update, { new: true });
    if (!page && expectedRevision === 0) {
      try {
        page = await WrittenAttemptPage.create({ attemptId: attempt._id, pageNumber, annotation, revision: 1 });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    if (!page) {
      const current = await WrittenAttemptPage.findOne({ attemptId: attempt._id, pageNumber }).lean();
      return res.status(409).json({
        message: 'This page was changed on another device',
        page: current ? { pageNumber, annotation: current.annotation, revision: current.revision, updatedAt: current.updatedAt } : null,
      });
    }
    res.json({ page: { pageNumber: page.pageNumber, annotation: page.annotation, revision: page.revision, updatedAt: page.updatedAt } });
  } catch (error) {
    next(error);
  }
};

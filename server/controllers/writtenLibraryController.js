const path = require('path');
const mongoose = require('mongoose');
const WrittenPaperLibrary = require('../models/WrittenPaperLibrary');
const { isDatabaseReady } = require('../config/db');
const { getLocalWrittenPapers, getLocalWrittenPaper } = require('../services/localWrittenPaperLibrary');
const { localAssetPath, remoteAssetUrl } = require('../services/writtenPaperAssetStore');

function isLocalId(id) {
  return String(id).startsWith('local-written-');
}

async function findPaper(id) {
  if (isLocalId(id)) return getLocalWrittenPaper(id);
  if (!mongoose.isValidObjectId(id)) return null;
  if (!isDatabaseReady()) return null;
  return WrittenPaperLibrary.findOne({ _id: id, status: 'ready' }).lean();
}

function toDTO(paper, includeAssets = false) {
  const dto = {
    id: String(paper._id),
    examBoard: paper.examBoard,
    qualification: paper.qualification,
    syllabusCode: paper.syllabusCode,
    subject: paper.subject,
    syllabusVersion: paper.syllabusVersion || '',
    year: paper.year,
    session: paper.session,
    sessionCode: paper.sessionCode,
    component: paper.component,
    paperNumber: paper.paperNumber,
    paperType: paper.paperType,
    title: paper.title,
    durationMinutes: paper.durationMinutes,
    totalMarks: paper.totalMarks,
    questionCount: paper.questionCount || null,
    pageCount: paper.pageCount || null,
    calculatorPolicy: paper.calculatorPolicy || 'varies',
    componentThreshold: paper.componentThreshold || null,
    difficulty: paper.difficulty || paper.componentThreshold?.difficulty || 'unknown',
    status: paper.status,
  };
  if (includeAssets) dto.assets = (paper.assets || []).map(({ role, sha256 }) => ({ role, sha256: sha256 || '' }));
  return dto;
}

function foldersFromPapers(papers) {
  const subjects = new Map();
  for (const paper of papers) {
    const subjectKey = `${paper.syllabusCode}:${paper.subject}`;
    if (!subjects.has(subjectKey)) subjects.set(subjectKey, { syllabusCode: paper.syllabusCode, subject: paper.subject, count: 0, years: new Map() });
    const subject = subjects.get(subjectKey);
    subject.count += 1;
    if (!subject.years.has(paper.year)) subject.years.set(paper.year, { year: paper.year, count: 0, sessions: [] });
    const year = subject.years.get(paper.year);
    year.count += 1;
    const session = year.sessions.find((item) => item.code === paper.sessionCode);
    if (session) session.count += 1;
    else year.sessions.push({ code: paper.sessionCode, label: paper.session, count: 1 });
  }
  return [...subjects.values()]
    .map((subject) => ({
      ...subject,
      years: [...subject.years.values()]
        .map((year) => ({ ...year, sessions: year.sessions.sort((left, right) => left.code.localeCompare(right.code)) }))
        .sort((left, right) => right.year - left.year),
    }))
    .sort((left, right) => left.subject.localeCompare(right.subject));
}

exports.getWrittenPaperFolders = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      const papers = await getLocalWrittenPapers();
      return res.json({ folders: foldersFromPapers(papers), source: 'local' });
    }
    const rows = await WrittenPaperLibrary.aggregate([
      { $match: { status: 'ready' } },
      { $group: { _id: { syllabusCode: '$syllabusCode', subject: '$subject', year: '$year', sessionCode: '$sessionCode', session: '$session' }, count: { $sum: 1 } } },
      { $sort: { '_id.subject': 1, '_id.year': -1, '_id.sessionCode': 1 } },
    ]);
    const papers = rows.flatMap((row) => Array.from({ length: row.count }, () => ({
      syllabusCode: row._id.syllabusCode,
      subject: row._id.subject,
      year: row._id.year,
      sessionCode: row._id.sessionCode,
      session: row._id.session,
    })));
    return res.json({ folders: foldersFromPapers(papers), source: 'database' });
  } catch (error) {
    next(error);
  }
};

exports.getWrittenPapers = async (req, res, next) => {
  try {
    const { subject, syllabusCode, year, sessionCode, paperNumber, difficulty } = req.query;
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 60));
    const page = Math.max(1, Number(req.query.page) || 1);
    let papers;
    let total;
    let source = 'database';
    if (isDatabaseReady()) {
      const query = { status: 'ready' };
      if (subject) query.subject = subject;
      if (syllabusCode) query.syllabusCode = syllabusCode;
      if (year) query.year = Number(year);
      if (sessionCode) query.sessionCode = sessionCode;
      if (paperNumber) query.paperNumber = String(paperNumber);
      if (difficulty) query.difficulty = difficulty;
      [papers, total] = await Promise.all([
        WrittenPaperLibrary.find(query).sort({ subject: 1, year: -1, sessionCode: 1, component: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        WrittenPaperLibrary.countDocuments(query),
      ]);
    } else {
      source = 'local';
      const matches = (await getLocalWrittenPapers()).filter((paper) => (
        (!subject || paper.subject === subject) &&
        (!syllabusCode || paper.syllabusCode === syllabusCode) &&
        (!year || paper.year === Number(year)) &&
        (!sessionCode || paper.sessionCode === sessionCode) &&
        (!paperNumber || paper.paperNumber === String(paperNumber)) &&
        (!difficulty || (paper.difficulty || paper.componentThreshold?.difficulty || 'unknown') === difficulty)
      ));
      total = matches.length;
      papers = matches.slice((page - 1) * limit, page * limit);
    }
    res.json({ papers: papers.map((paper) => toDTO(paper)), total, page, hasMore: page * limit < total, source });
  } catch (error) {
    next(error);
  }
};

exports.getWrittenPaper = async (req, res, next) => {
  try {
    const paper = await findPaper(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Written paper not found' });
    res.json({ paper: toDTO(paper, true) });
  } catch (error) {
    next(error);
  }
};

exports.getWrittenPaperPDF = async (req, res, next) => {
  try {
    const role = req.params.type === 'mark-scheme' ? 'mark_scheme' : req.params.type;
    if (!['question', 'mark_scheme', 'insert', 'formula_booklet'].includes(role)) {
      return res.status(400).json({ message: 'Invalid paper asset type' });
    }
    const paper = await findPaper(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Written paper not found' });
    const asset = (paper.assets || []).find((item) => item.role === role);
    const localPath = localAssetPath(asset);
    if (localPath) return res.type('application/pdf').sendFile(path.resolve(localPath));
    const remoteUrl = remoteAssetUrl(asset);
    if (remoteUrl) return res.redirect(302, remoteUrl);
    return res.status(404).json({ message: 'Paper file not found' });
  } catch (error) {
    next(error);
  }
};

exports.findWrittenPaper = findPaper;
exports.toWrittenPaperDTO = toDTO;

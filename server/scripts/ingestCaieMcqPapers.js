require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const PaperLibrary = require('../models/PaperLibrary');
const { parseMarkingScheme } = require('../services/markingSchemeParser');
const {
  parseGradeThresholds,
  thresholdToDTO,
} = require('../services/gradeThresholdParser');

const SOURCE_BASE_URLS = [
  'https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload',
  'https://dynamicpapers.com/wp-content/uploads/2015/09'
];
const STORAGE_ROOT = path.join(__dirname, '..', 'storage', 'papers', 'caie');

const SUBJECTS = [
  { code: '9702', name: 'Physics', totalQuestions: 40 },
  { code: '9701', name: 'Chemistry', totalQuestions: 40 },
  { code: '9700', name: 'Biology', totalQuestions: 40 },
  { code: '9708', name: 'Economics', totalQuestions: 30 }
];

const SESSIONS = [
  { code: 'm', label: 'March', variants: ['12'] },
  { code: 's', label: 'May/June', variants: ['11', '12', '13'] },
  { code: 'w', label: 'October/November', variants: ['11', '12', '13'] }
];

const DEFAULT_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    years: DEFAULT_YEARS,
    subjects: SUBJECTS.map((subject) => subject.code),
    dryRun: false,
    limit: Infinity
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--limit') options.limit = Number(args[index + 1] || Infinity);
    if (arg === '--years') {
      options.years = args[index + 1].split(',').map((year) => Number(year.trim()));
    }
    if (arg === '--subjects') {
      options.subjects = args[index + 1].split(',').map((subject) => subject.trim());
    }
  }

  return options;
}

function yearToken(year) {
  return String(year).slice(-2);
}

function fileName(subjectCode, sessionCode, year, fileType, component) {
  return `${subjectCode}_${sessionCode}${yearToken(year)}_${fileType}_${component}.pdf`;
}

function sourceUrls(name) {
  return SOURCE_BASE_URLS.map((baseUrl) => `${baseUrl}/${name}`);
}

function storagePath(subjectCode, year, sessionCode, component, kind) {
  return path.join(STORAGE_ROOT, subjectCode, String(year), sessionCode, component, `${kind}.pdf`);
}

function thresholdStoragePath(subjectCode, year, sessionCode) {
  return path.join(STORAGE_ROOT, subjectCode, String(year), sessionCode, 'grade_threshold.pdf');
}

async function headPdf(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    return response.ok && contentType.toLowerCase().includes('application/pdf');
  } catch {
    return false;
  }
}

async function findPdfUrl(name) {
  for (const url of sourceUrls(name)) {
    if (await headPdf(url)) return url;
  }

  return null;
}

async function downloadPdf(url, targetPath) {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) return 'cached';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/pdf')) {
    throw new Error(`Expected PDF but got ${contentType || 'unknown content type'}`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(targetPath, buffer);
  return 'downloaded';
}

function buildTasks(options) {
  const requestedSubjects = SUBJECTS.filter((subject) => options.subjects.includes(subject.code));
  const tasks = [];

  for (const subject of requestedSubjects) {
    for (const year of options.years) {
      for (const session of SESSIONS) {
        for (const component of session.variants) {
          tasks.push({ subject, year, session, component });
        }
      }
    }
  }

  return tasks;
}

async function ingestTask(task, options) {
  const { subject, year, session, component } = task;
  const qpFile = fileName(subject.code, session.code, year, 'qp', component);
  const msFile = fileName(subject.code, session.code, year, 'ms', component);
  const gtFile = `${subject.code}_${session.code}${yearToken(year)}_gt.pdf`;
  const [qpUrl, msUrl, gtUrl] = await Promise.all([
    findPdfUrl(qpFile),
    findPdfUrl(msFile),
    findPdfUrl(gtFile)
  ]);

  if (!qpUrl || !msUrl) {
    return {
      status: 'skipped',
      reason: `missing ${!qpUrl ? 'question paper' : ''}${!qpUrl && !msUrl ? ' and ' : ''}${!msUrl ? 'mark scheme' : ''}`,
      file: `${subject.code}_${session.code}${yearToken(year)}_${component}`
    };
  }

  const questionPaperPath = storagePath(subject.code, year, session.code, component, 'question');
  const markingSchemePath = storagePath(subject.code, year, session.code, component, 'mark_scheme');
  const gradeThresholdPath = thresholdStoragePath(subject.code, year, session.code);

  if (options.dryRun) {
    return { status: 'ready', file: `${subject.code}_${session.code}${yearToken(year)}_${component}` };
  }

  const [questionPaperResult, markingSchemeResult] = await Promise.all([
    downloadPdf(qpUrl, questionPaperPath),
    downloadPdf(msUrl, markingSchemePath)
  ]);
  if (gtUrl) await downloadPdf(gtUrl, gradeThresholdPath);

  const parseResult = await parseMarkingScheme(markingSchemePath);
  const thresholds = gtUrl ? await parseGradeThresholds(gradeThresholdPath) : null;
  const componentThreshold = thresholdToDTO(thresholds?.components?.[component]);
  const discountedQuestions = parseResult.discountedQuestions || [];
  const isReady = parseResult.totalFound + discountedQuestions.length >= subject.totalQuestions;
  const title = `${subject.name} ${subject.code} Paper ${component} ${session.label} ${year}`;

  await PaperLibrary.findOneAndUpdate(
    {
      examBoard: 'CAIE',
      syllabusCode: subject.code,
      year,
      sessionCode: session.code,
      component
    },
    {
      examBoard: 'CAIE',
      qualification: 'AS/A Level',
      syllabusCode: subject.code,
      subject: subject.name,
      year,
      session: session.label,
      sessionCode: session.code,
      component,
      paperNumber: '1',
      paperType: 'MCQ',
      title,
      questionPaperPath,
      markingSchemePath,
      questionPaperSourceUrl: qpUrl,
      markingSchemeSourceUrl: msUrl,
      gradeThresholdPath: gtUrl ? gradeThresholdPath : '',
      gradeThresholdSourceUrl: gtUrl || '',
      componentThreshold,
      difficulty: componentThreshold?.difficulty || 'unknown',
      sourceHost: new URL(qpUrl).host,
      answers: parseResult.answers,
      discountedQuestions,
      totalQuestions: subject.totalQuestions,
      parseConfidence: parseResult.confidence,
      parseStrategy: parseResult.strategy,
      parseTotalFound: parseResult.totalFound,
      status: isReady ? 'ready' : 'needs_review'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    status: isReady ? 'ready' : 'needs_review',
    file: `${subject.code}_${session.code}${yearToken(year)}_${component}`,
    questionPaper: questionPaperResult,
    markingScheme: markingSchemeResult,
    answers: parseResult.totalFound,
    confidence: parseResult.confidence
  };
}

async function main() {
  const options = parseArgs();
  const tasks = buildTasks(options).slice(0, options.limit);

  if (!process.env.MONGODB_URI && !options.dryRun) {
    throw new Error('MONGODB_URI is required unless --dry-run is used.');
  }

  if (!options.dryRun) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const summary = { ready: 0, needs_review: 0, skipped: 0, failed: 0 };

  for (const task of tasks) {
    try {
      const result = await ingestTask(task, options);
      summary[result.status] += 1;
      console.log(`${result.status.padEnd(12)} ${result.file} ${result.reason || `${result.answers || 0} answers ${result.confidence || ''}`}`);
    } catch (error) {
      summary.failed += 1;
      const label = `${task.subject.code}_${task.session.code}${yearToken(task.year)}_${task.component}`;
      console.log(`failed       ${label} ${error.message}`);
    }
  }

  if (!options.dryRun) {
    await mongoose.disconnect();
  }

  console.log(`summary      ready=${summary.ready} needs_review=${summary.needs_review} skipped=${summary.skipped} failed=${summary.failed}`);
}

main().catch(async (error) => {
  console.error(error.message);
  if (mongoose.connection.readyState) await mongoose.disconnect();
  process.exit(1);
});

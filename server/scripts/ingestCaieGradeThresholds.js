require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const PaperLibrary = require('../models/PaperLibrary');
const {
  parseGradeThresholds,
  thresholdToDTO,
} = require('../services/gradeThresholdParser');

const SOURCE_BASE_URLS = [
  'https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload',
  'https://dynamicpapers.com/wp-content/uploads/2015/09',
];
const STORAGE_ROOT = path.join(__dirname, '..', 'storage', 'papers', 'caie');
const SUBJECTS = ['9702', '9701', '9700', '9708'];
const SESSIONS = [
  { code: 'm', label: 'March' },
  { code: 's', label: 'May/June' },
  { code: 'w', label: 'October/November' },
];
const DEFAULT_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    years: DEFAULT_YEARS,
    subjects: SUBJECTS,
    updateDb: false,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--years') options.years = args[index + 1].split(',').map((year) => Number(year.trim()));
    if (args[index] === '--subjects') options.subjects = args[index + 1].split(',').map((subject) => subject.trim());
    if (args[index] === '--update-db') options.updateDb = true;
    if (args[index] === '--dry-run') options.dryRun = true;
  }

  return options;
}

function yearToken(year) {
  return String(year).slice(-2);
}

function fileName(subjectCode, sessionCode, year) {
  return `${subjectCode}_${sessionCode}${yearToken(year)}_gt.pdf`;
}

function sourceUrls(name) {
  return SOURCE_BASE_URLS.map((baseUrl) => `${baseUrl}/${name}`);
}

function thresholdPath(subjectCode, year, sessionCode) {
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

async function downloadPdf(url, targetPath, dryRun) {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) return 'cached';
  if (dryRun) return 'ready';

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/pdf')) {
    throw new Error(`Expected PDF but got ${contentType || 'unknown content type'}`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(await response.arrayBuffer()));
  return 'downloaded';
}

async function updateDatabase(task, filePath, url) {
  const parsed = await parseGradeThresholds(filePath);
  const operations = Object.entries(parsed.components).map(([component, threshold]) =>
    PaperLibrary.updateMany(
      {
        syllabusCode: task.subjectCode,
        year: task.year,
        sessionCode: task.session.code,
        component,
      },
      {
        gradeThresholdPath: filePath,
        gradeThresholdSourceUrl: url,
        componentThreshold: thresholdToDTO(threshold),
        difficulty: thresholdToDTO(threshold)?.difficulty || 'unknown',
      },
    ),
  );
  await Promise.all(operations);
  return operations.length;
}

async function handleTask(task, options) {
  const name = fileName(task.subjectCode, task.session.code, task.year);
  const url = await findPdfUrl(name);
  if (!url) return { status: 'skipped', file: name, reason: 'not found' };

  const targetPath = thresholdPath(task.subjectCode, task.year, task.session.code);
  const result = await downloadPdf(url, targetPath, options.dryRun);
  let componentCount = 0;

  if (!options.dryRun) {
    const parsed = await parseGradeThresholds(targetPath);
    componentCount = Object.keys(parsed.components).length;
    if (options.updateDb) componentCount = await updateDatabase(task, targetPath, url);
  }

  return { status: 'ready', file: name, result, components: componentCount };
}

async function main() {
  const options = parseArgs();
  if (options.updateDb && !options.dryRun) await mongoose.connect(process.env.MONGODB_URI);

  const summary = { ready: 0, skipped: 0, failed: 0 };
  const tasks = options.subjects.flatMap((subjectCode) =>
    options.years.flatMap((year) =>
      SESSIONS.map((session) => ({ subjectCode, year, session })),
    ),
  );

  for (const task of tasks) {
    try {
      const outcome = await handleTask(task, options);
      summary[outcome.status] += 1;
      console.log(`${outcome.status.padEnd(8)} ${outcome.file} ${outcome.reason || `${outcome.result} ${outcome.components} components`}`);
    } catch (error) {
      summary.failed += 1;
      console.log(`failed   ${fileName(task.subjectCode, task.session.code, task.year)} ${error.message}`);
    }
  }

  if (mongoose.connection.readyState) await mongoose.disconnect();
  console.log(`summary  ready=${summary.ready} skipped=${summary.skipped} failed=${summary.failed}`);
}

main().catch(async (error) => {
  console.error(error.message);
  if (mongoose.connection.readyState) await mongoose.disconnect();
  process.exit(1);
});

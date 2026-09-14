require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const crypto = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');
const WrittenPaperLibrary = require('../models/WrittenPaperLibrary');
const { SUBJECT_NAMES, WRITTEN_PAPER_SPECS, getWrittenPaperSpec } = require('../config/writtenPaperSpecs');
const { parseGradeThresholds, thresholdToDTO } = require('../services/gradeThresholdParser');

const SOURCE_BASE_URLS = [
  'https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload',
  'https://dynamicpapers.com/wp-content/uploads/2015/09',
];
const STORAGE_ROOT = path.join(__dirname, '..', 'storage', 'written-papers', 'caie');
const FIRST_ARCHIVE_YEAR = 2015;
const DEFAULT_YEARS = Array.from(
  { length: Math.max(1, new Date().getFullYear() - FIRST_ARCHIVE_YEAR + 1) },
  (_, index) => FIRST_ARCHIVE_YEAR + index,
);
const SESSIONS = [
  { code: 'm', label: 'March', variants: ['2'] },
  { code: 's', label: 'May/June', variants: ['1', '2', '3'] },
  { code: 'w', label: 'October/November', variants: ['1', '2', '3'] },
];

function yearToken(year) {
  return String(year).slice(-2);
}

function fileName(syllabusCode, sessionCode, year, kind, component) {
  return `${syllabusCode}_${sessionCode}${yearToken(year)}_${kind}_${component}.pdf`;
}

function storagePath(syllabusCode, year, sessionCode, component, fileName) {
  return path.join(STORAGE_ROOT, syllabusCode, String(year), sessionCode, component, fileName);
}

function parseArgs(args = process.argv.slice(2)) {
  const options = {
    years: DEFAULT_YEARS,
    subjects: Object.keys(SUBJECT_NAMES),
    paperNumbers: [...new Set(WRITTEN_PAPER_SPECS.map((spec) => spec.paperNumber))],
    dryRun: false,
    noDatabase: false,
    huggingFaceRepo: process.env.HF_DATASET_REPO || '',
    publishToHuggingFace: false,
    limit: Infinity,
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--years') options.years = args[index + 1].split(',').map(Number);
    if (value === '--subjects') options.subjects = args[index + 1].split(',').map((item) => item.trim());
    if (value === '--papers') options.paperNumbers = args[index + 1].split(',').map((item) => item.trim());
    if (value === '--limit') options.limit = Number(args[index + 1] || Infinity);
    if (value === '--dry-run') options.dryRun = true;
    if (value === '--no-database') options.noDatabase = true;
    if (value === '--hf-repo') options.huggingFaceRepo = args[index + 1].trim();
    if (value === '--publish-huggingface') options.publishToHuggingFace = true;
  }
  return options;
}

function remotePath(syllabusCode, year, sessionCode, component, fileName) {
  return `caie/${syllabusCode}/${year}/${sessionCode}/${component}/${fileName}`;
}

function huggingFaceUrl(repository, assetPath) {
  if (!repository || !assetPath) return '';
  const encodedPath = assetPath.split('/').map(encodeURIComponent).join('/');
  return `https://huggingface.co/datasets/${repository}/resolve/main/${encodedPath}?download=true`;
}

function publishFolderToHuggingFace(repository) {
  if (!repository) throw new Error('A Hugging Face dataset repository is required when publishing');
  const helper = path.join(__dirname, 'uploadHuggingFaceAssets.py');
  const result = spawnSync(process.env.PYTHON || 'python', [helper, '--folder', STORAGE_ROOT, '--repo', repository, '--path-in-repo', 'caie'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Hugging Face upload failed. Run `hf auth login` and try again.');
}

async function publishRemoteAssetUrls(repository) {
  const papers = await WrittenPaperLibrary.find({ 'assets.remotePath': { $ne: '' } });
  await Promise.all(papers.map(async (paper) => {
    paper.assets.forEach((asset) => {
      if (asset.remotePath) asset.remoteUrl = huggingFaceUrl(repository, asset.remotePath);
    });
    await paper.save();
  }));
}

function buildTasks(options) {
  const tasks = [];
  for (const syllabusCode of options.subjects) {
    if (!SUBJECT_NAMES[syllabusCode]) continue;
    for (const spec of WRITTEN_PAPER_SPECS.filter((item) => item.syllabusCode === syllabusCode && options.paperNumbers.includes(item.paperNumber))) {
      for (const year of options.years) {
        for (const session of SESSIONS) {
          for (const variant of session.variants) tasks.push({ syllabusCode, spec, year, session, component: `${spec.paperNumber}${variant}` });
        }
      }
    }
  }
  return tasks.slice(0, options.limit);
}

async function responseIsPdf(response) {
  if (!response?.ok) return false;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/pdf') || contentType.includes('application/octet-stream');
}

async function findPdfUrl(name) {
  for (const baseUrl of SOURCE_BASE_URLS) {
    const url = `${baseUrl}/${name}`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (await responseIsPdf(response)) return url;
    } catch {
      // Try the next configured source. Some hosts do not allow HEAD requests.
    }
  }
  return null;
}

async function downloadPdf(url, targetPath, dryRun) {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) return { status: 'cached', sha256: sha256File(targetPath) };
  if (dryRun) return { status: 'would_download', sha256: '' };
  const response = await fetch(url);
  if (!(await responseIsPdf(response))) throw new Error(`Expected a PDF, got HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('Downloaded file does not have a PDF signature');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  return { status: 'downloaded', sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function validatePdf(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) throw new Error('PDF is missing or unexpectedly small');
  const buffer = fs.readFileSync(filePath);
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF signature check failed');
  const parsed = await pdfParse(buffer);
  if (!parsed.numpages) throw new Error('PDF has no pages');
  return { sha256: sha256File(filePath), pages: parsed.numpages };
}

async function optionalAsset(syllabusCode, year, sessionCode, component, role, token, dryRun) {
  const name = fileName(syllabusCode, sessionCode, year, token, component);
  const url = await findPdfUrl(name);
  if (!url) return null;
  const targetPath = storagePath(syllabusCode, year, sessionCode, component, `${role}.pdf`);
  const result = await downloadPdf(url, targetPath, dryRun);
  if (!dryRun) await validatePdf(targetPath);
  return { role, path: targetPath, remotePath: remotePath(syllabusCode, year, sessionCode, component, `${role}.pdf`), sourceUrl: url, sha256: result.sha256 };
}

async function ingestTask(task, options) {
  const { syllabusCode, spec, year, session, component } = task;
  const qpName = fileName(syllabusCode, session.code, year, 'qp', component);
  const msName = fileName(syllabusCode, session.code, year, 'ms', component);
  const [questionUrl, markingUrl] = await Promise.all([findPdfUrl(qpName), findPdfUrl(msName)]);
  if (!questionUrl || !markingUrl) return { status: 'skipped', label: `${syllabusCode}_${session.code}${yearToken(year)}_${component}`, reason: 'question paper or mark scheme unavailable' };

  const questionPath = storagePath(syllabusCode, year, session.code, component, 'question.pdf');
  const markingPath = storagePath(syllabusCode, year, session.code, component, 'mark_scheme.pdf');
  if (options.dryRun) return { status: 'ready', label: `${syllabusCode}_${session.code}${yearToken(year)}_${component}`, reason: 'would download validated PDF pair' };

  const [questionResult, markingResult] = await Promise.all([
    downloadPdf(questionUrl, questionPath, false),
    downloadPdf(markingUrl, markingPath, false),
  ]);
  const [questionMeta] = await Promise.all([validatePdf(questionPath), validatePdf(markingPath)]);
  const extras = (await Promise.all([
    optionalAsset(syllabusCode, year, session.code, component, 'insert', 'in', false),
    optionalAsset(syllabusCode, year, session.code, component, 'formula_booklet', 'sf', false),
  ])).filter(Boolean);

  const thresholdName = `${syllabusCode}_${session.code}${yearToken(year)}_gt.pdf`;
  const thresholdUrl = await findPdfUrl(thresholdName);
  let componentThreshold = null;
  if (thresholdUrl) {
    const thresholdPath = path.join(STORAGE_ROOT, syllabusCode, String(year), session.code, 'grade_threshold.pdf');
    await downloadPdf(thresholdUrl, thresholdPath, false);
    const thresholds = await parseGradeThresholds(thresholdPath);
    componentThreshold = thresholdToDTO(thresholds.components?.[component]);
  }

  const assets = [
    { role: 'question', path: questionPath, remotePath: remotePath(syllabusCode, year, session.code, component, 'question.pdf'), sourceUrl: questionUrl, sha256: questionResult.sha256 || questionMeta.sha256 },
    { role: 'mark_scheme', path: markingPath, remotePath: remotePath(syllabusCode, year, session.code, component, 'mark_scheme.pdf'), sourceUrl: markingUrl, sha256: markingResult.sha256 || sha256File(markingPath) },
    ...extras,
  ];
  const paper = {
    examBoard: 'CAIE', qualification: 'AS/A Level', syllabusCode, subject: SUBJECT_NAMES[syllabusCode],
    year, session: session.label, sessionCode: session.code, component, paperNumber: spec.paperNumber,
    paperType: spec.paperType, title: `${SUBJECT_NAMES[syllabusCode]} ${syllabusCode} Paper ${component} ${session.label} ${year}`,
    durationMinutes: spec.durationMinutes, totalMarks: spec.totalMarks, pageCount: questionMeta.pages,
    calculatorPolicy: ['9708', '9709', '9231'].includes(syllabusCode) ? 'allowed' : 'varies',
    assets, componentThreshold, difficulty: componentThreshold?.difficulty || 'unknown', sourceHost: new URL(questionUrl).host, status: 'ready',
  };
  if (!options.noDatabase) {
    await WrittenPaperLibrary.findOneAndUpdate(
      { examBoard: 'CAIE', syllabusCode, year, sessionCode: session.code, component },
      paper,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  return { status: 'ready', label: `${syllabusCode}_${session.code}${yearToken(year)}_${component}`, reason: `${questionMeta.pages} pages; ${questionResult.status}/${markingResult.status}` };
}

async function main() {
  const options = parseArgs();
  if (!options.dryRun && !options.noDatabase && !process.env.MONGODB_URI) throw new Error('MONGODB_URI is required unless --dry-run or --no-database is used.');
  if (!options.dryRun && !options.noDatabase) await mongoose.connect(process.env.MONGODB_URI);
  const summary = { ready: 0, skipped: 0, failed: 0 };
  for (const task of buildTasks(options)) {
    try {
      const outcome = await ingestTask(task, options);
      summary[outcome.status] += 1;
      console.log(`${outcome.status.padEnd(8)} ${outcome.label} ${outcome.reason}`);
    } catch (error) {
      summary.failed += 1;
      console.log(`failed   ${task.syllabusCode}_${task.session.code}${yearToken(task.year)}_${task.component} ${error.message}`);
    }
  }
  if (options.publishToHuggingFace && !options.dryRun) {
    publishFolderToHuggingFace(options.huggingFaceRepo);
    if (!options.noDatabase) await publishRemoteAssetUrls(options.huggingFaceRepo);
  }
  if (mongoose.connection.readyState) await mongoose.disconnect();
  console.log(`summary  ready=${summary.ready} skipped=${summary.skipped} failed=${summary.failed}`);
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error.message);
    if (mongoose.connection.readyState) await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { buildTasks, getWrittenPaperSpec, parseArgs, yearToken, remotePath };

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SUBJECT_NAMES, getWrittenPaperSpec } = require('../config/writtenPaperSpecs');

const ROOT = path.resolve(__dirname, '..', 'storage', 'written-papers', 'caie');
const SESSIONS = { m: 'March', s: 'May/June', w: 'October/November' };
let catalogPromise;

function directories(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function findAsset(folder, candidates) {
  return candidates.map((name) => path.join(folder, name)).find((filePath) => fs.existsSync(filePath)) || null;
}

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function buildCatalog() {
  const papers = [];
  for (const [syllabusCode, subject] of Object.entries(SUBJECT_NAMES)) {
    for (const year of directories(path.join(ROOT, syllabusCode)).filter((item) => /^20\d{2}$/.test(item))) {
      for (const sessionCode of Object.keys(SESSIONS)) {
        const sessionFolder = path.join(ROOT, syllabusCode, year, sessionCode);
        for (const component of directories(sessionFolder).filter((item) => /^\d{2}$/.test(item))) {
          const spec = getWrittenPaperSpec(syllabusCode, component);
          if (!spec) continue;

          const folder = path.join(sessionFolder, component);
          const questionPaperPath = findAsset(folder, ['question.pdf']);
          const markingSchemePath = findAsset(folder, ['mark_scheme.pdf']);
          if (!questionPaperPath || !markingSchemePath) continue;

          const extraAssets = [
            ['insert', 'insert.pdf'],
            ['formula_booklet', 'formula_booklet.pdf'],
          ].map(([role, fileName]) => {
            const assetPath = findAsset(folder, [fileName]);
            return assetPath ? { role, path: assetPath, sha256: sha256(assetPath) } : null;
          }).filter(Boolean);

          papers.push({
            _id: `local-written-${syllabusCode}-${year}-${sessionCode}-${component}`,
            examBoard: 'CAIE',
            qualification: 'AS/A Level',
            syllabusCode,
            subject,
            year: Number(year),
            session: SESSIONS[sessionCode],
            sessionCode,
            component,
            paperNumber: spec.paperNumber,
            paperType: spec.paperType,
            title: `${subject} ${syllabusCode} Paper ${component} ${sessionCode.toUpperCase()} ${year}`,
            durationMinutes: spec.durationMinutes,
            totalMarks: spec.totalMarks,
            calculatorPolicy: ['9708', '9709', '9231'].includes(syllabusCode) ? 'allowed' : 'varies',
            assets: [
              { role: 'question', path: questionPaperPath, sha256: sha256(questionPaperPath) },
              { role: 'mark_scheme', path: markingSchemePath, sha256: sha256(markingSchemePath) },
              ...extraAssets,
            ],
            status: 'ready',
          });
        }
      }
    }
  }
  return papers.sort((a, b) => a.subject.localeCompare(b.subject) || b.year - a.year || a.component.localeCompare(b.component));
}

function getLocalWrittenPapers() {
  if (!catalogPromise) {
    catalogPromise = buildCatalog().catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

async function getLocalWrittenPaper(id) {
  return (await getLocalWrittenPapers()).find((paper) => paper._id === id) || null;
}

function clearLocalWrittenPaperCatalog() {
  catalogPromise = null;
}

module.exports = { getLocalWrittenPapers, getLocalWrittenPaper, clearLocalWrittenPaperCatalog };

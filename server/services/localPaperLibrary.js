const fs = require('fs');
const path = require('path');
const { parseMarkingScheme } = require('./markingSchemeParser');
const {
  parseGradeThresholds,
  thresholdToDTO,
} = require('./gradeThresholdParser');

const root = path.resolve(__dirname, '..', 'storage', 'papers', 'caie');
const subjects = {
  9700: 'Biology',
  9701: 'Chemistry',
  9702: 'Physics',
  9708: 'Economics',
};
const sessions = { m: 'March', s: 'May/June', w: 'October/November' };
let catalogPromise;
let folderCatalogPromise;
const thresholdCache = new Map();
const directories = (folder) =>
  fs.existsSync(folder)
    ? fs
        .readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

// Only the public, already-downloaded paper collection is available without MongoDB.
async function buildCatalog() {
  const papers = [];
  for (const [syllabusCode, subject] of Object.entries(subjects)) {
    for (const year of directories(path.join(root, syllabusCode)).filter(
      (value) => /^20\d{2}$/.test(value),
    )) {
      for (const [sessionCode, session] of Object.entries(sessions)) {
        for (const component of directories(
          path.join(root, syllabusCode, year, sessionCode),
        ).filter((value) => /^1[123]$/.test(value))) {
          const folder = path.join(
            root,
            syllabusCode,
            year,
            sessionCode,
            component,
          );
          const thresholdFilePath = path.join(
            root,
            syllabusCode,
            year,
            sessionCode,
            'grade_threshold.pdf',
          );
          const questionPaperPath = path.join(folder, 'question.pdf');
          const markingSchemePath = path.join(folder, 'mark_scheme.pdf');
          if (
            !fs.existsSync(questionPaperPath) ||
            !fs.existsSync(markingSchemePath)
          )
            continue;
          const parsed = await parseMarkingScheme(markingSchemePath);
          let componentThreshold = null;
          if (fs.existsSync(thresholdFilePath)) {
            if (!thresholdCache.has(thresholdFilePath)) {
              thresholdCache.set(
                thresholdFilePath,
                parseGradeThresholds(thresholdFilePath),
              );
            }
            const thresholds = await thresholdCache.get(thresholdFilePath);
            componentThreshold = thresholdToDTO(
              thresholds.components?.[component],
            );
          }
          const totalQuestions = syllabusCode === '9708' ? 30 : 40;
          const discountedQuestions = parsed.discountedQuestions || [];
          const complete = Array.from(
            { length: totalQuestions },
            (_, i) => i + 1,
          ).every(
            (q) =>
              /^[A-D]$/.test(parsed.answers?.[q] || '') ||
              discountedQuestions.includes(q),
          );
          if (!complete) continue;
          papers.push({
            _id: `local-${syllabusCode}-${year}-${sessionCode}-${component}`,
            examBoard: 'CAIE',
            qualification: 'AS & A Level',
            syllabusCode,
            subject,
            year: Number(year),
            session,
            sessionCode,
            component,
            paperNumber: '1',
            paperType: 'MCQ',
            title: `${subject} ${syllabusCode} Paper ${component} ${session} ${year}`,
            totalQuestions,
            discountedQuestions,
            status: 'ready',
            questionPaperPath,
            markingSchemePath,
            gradeThresholdPath: fs.existsSync(thresholdFilePath)
              ? thresholdFilePath
              : null,
            componentThreshold,
            difficulty: componentThreshold?.difficulty || 'unknown',
            answers: new Map(Object.entries(parsed.answers)),
          });
        }
      }
    }
  }
  return papers.sort(
    (a, b) =>
      a.subject.localeCompare(b.subject) ||
      b.year - a.year ||
      a.sessionCode.localeCompare(b.sessionCode) ||
      a.component.localeCompare(b.component),
  );
}

function getLocalPapers() {
  if (!catalogPromise)
    catalogPromise = buildCatalog().catch((error) => {
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
}

async function buildFolderCatalog() {
  const folders = [];
  for (const [syllabusCode, subject] of Object.entries(subjects)) {
    for (const year of directories(path.join(root, syllabusCode)).filter(
      (value) => /^20\d{2}$/.test(value),
    )) {
      for (const [sessionCode, session] of Object.entries(sessions)) {
        const sessionFolder = path.join(root, syllabusCode, year, sessionCode);
        const paperCount = directories(sessionFolder).filter((component) => {
          if (!/^1[123]$/.test(component)) return false;
          const folder = path.join(sessionFolder, component);
          return fs.existsSync(path.join(folder, 'question.pdf'))
            && fs.existsSync(path.join(folder, 'mark_scheme.pdf'));
        }).length;
        if (!paperCount) continue;
        folders.push({
          subject,
          syllabusCode,
          year: Number(year),
          session,
          sessionCode,
          paperCount,
        });
      }
    }
  }
  return folders.sort(
    (a, b) => a.subject.localeCompare(b.subject)
      || b.year - a.year
      || a.sessionCode.localeCompare(b.sessionCode),
  );
}

function getLocalPaperFolders() {
  if (!folderCatalogPromise) {
    folderCatalogPromise = buildFolderCatalog().catch((error) => {
      folderCatalogPromise = null;
      throw error;
    });
  }
  return folderCatalogPromise;
}
async function getLocalPaper(id) {
  return (await getLocalPapers()).find((paper) => paper._id === id) || null;
}
module.exports = { getLocalPapers, getLocalPaper, getLocalPaperFolders };

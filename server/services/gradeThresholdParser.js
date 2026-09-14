const fs = require('fs');
const pdfParse = require('pdf-parse');

const GRADE_KEYS = ['A', 'B', 'C', 'D', 'E'];

function toNumber(value) {
  if (!value || /[-–—]/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyDifficulty(threshold) {
  if (!threshold?.maxRaw || !threshold?.grades?.A) return 'unknown';
  const ratio = threshold.grades.A / threshold.maxRaw;
  if (ratio <= 0.66) return 'hard';
  if (ratio <= 0.76) return 'balanced';
  return 'accessible';
}

function thresholdToDTO(threshold) {
  if (!threshold?.maxRaw) return null;
  const aMark = threshold.grades?.A ?? null;
  return {
    maxRaw: threshold.maxRaw,
    grades: threshold.grades || {},
    aMark,
    aPercent: aMark ? Math.round((aMark / threshold.maxRaw) * 100) : null,
    difficulty: classifyDifficulty(threshold),
  };
}

async function parseGradeThresholds(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { components: {}, sourcePath: filePath || null };
  }

  const data = await pdfParse(fs.readFileSync(filePath));
  const components = {};

  for (const rawLine of data.text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    const match = line.match(/^Component\s+(\d{2})\s+(\d+)\s+(.+)$/i);
    if (!match) continue;

    const [, component, maxRawText, rest] = match;
    const marks = rest
      .split(' ')
      .map(toNumber)
      .filter((value) => value !== undefined)
      .slice(0, GRADE_KEYS.length);

    if (marks.length < GRADE_KEYS.length) continue;

    components[component] = {
      component,
      maxRaw: Number(maxRawText),
      grades: Object.fromEntries(
        GRADE_KEYS.map((grade, index) => [grade, marks[index]]),
      ),
    };
  }

  return { components, sourcePath: filePath };
}

function gradeForScore(score, threshold) {
  if (!threshold?.grades || !Number.isFinite(score)) return null;
  for (const grade of GRADE_KEYS) {
    const mark = threshold.grades[grade];
    if (Number.isFinite(mark) && score >= mark) return grade;
  }
  return 'U';
}

module.exports = {
  classifyDifficulty,
  gradeForScore,
  parseGradeThresholds,
  thresholdToDTO,
};

const fs = require('fs');
const path = require('path');
const { parseGradeThresholds, thresholdToDTO } = require('./gradeThresholdParser');

const storageRoot = path.resolve(__dirname, '..', 'storage', 'papers', 'caie');
const parsedFiles = new Map();

function hasUsableThreshold(threshold) {
  return Boolean(
    Number.isFinite(Number(threshold?.maxRaw))
    && Object.values(threshold?.grades || {}).some((mark) => Number.isFinite(Number(mark))),
  );
}

function candidatePaths(paper) {
  const localPath = paper?.syllabusCode && paper?.year && paper?.sessionCode
    ? path.join(storageRoot, String(paper.syllabusCode), String(paper.year), String(paper.sessionCode), 'grade_threshold.pdf')
    : null;
  return [...new Set([paper?.gradeThresholdPath, localPath].filter(Boolean))];
}

async function readThresholdFile(filePath) {
  if (!parsedFiles.has(filePath)) {
    parsedFiles.set(filePath, parseGradeThresholds(filePath).catch((error) => {
      parsedFiles.delete(filePath);
      throw error;
    }));
  }
  return parsedFiles.get(filePath);
}

async function resolveComponentThreshold(paper) {
  if (hasUsableThreshold(paper?.componentThreshold)) return paper.componentThreshold;

  for (const filePath of candidatePaths(paper)) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = await readThresholdFile(filePath);
      const threshold = thresholdToDTO(parsed.components?.[String(paper.component)]);
      if (hasUsableThreshold(threshold)) return threshold;
    } catch {
      // A bad optional threshold file must not make a paper unavailable.
    }
  }

  return null;
}

module.exports = {
  candidatePaths,
  hasUsableThreshold,
  resolveComponentThreshold,
};

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const cropRoot = path.resolve(__dirname, '..', 'storage', 'question-crops');
const scriptPath = path.resolve(__dirname, '..', 'scripts', 'experiment_crop_questions.py');

function getPythonCommand() {
  return process.env.PYTHON_BIN || 'python';
}

function getPaperCropDir(paperId) {
  return path.join(cropRoot, String(paperId));
}

function getManifestPath(paperId) {
  return path.join(getPaperCropDir(paperId), 'manifest.json');
}

function readManifest(paperId) {
  const manifestPath = getManifestPath(paperId);
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function runCropper(paper) {
  const totalQuestions = paper.totalQuestions || 40;
  const questions = Array.from({ length: totalQuestions }, (_, index) => index + 1).join(',');

  return new Promise((resolve, reject) => {
    fs.mkdirSync(getPaperCropDir(paper._id), { recursive: true });
    execFile(
      getPythonCommand(),
      [
        scriptPath,
        '--pdf',
        paper.questionPaperPath,
        '--out',
        cropRoot,
        '--slug',
        String(paper._id),
        '--questions',
        questions,
        '--total',
        String(totalQuestions),
        '--dpi',
        String(process.env.CROP_DPI || 220),
      ],
      { windowsHide: true, timeout: 120000 },
      (error, stdout, stderr) => {
        if (error) {
          error.message = `${error.message}\n${stderr || stdout}`;
          reject(error);
          return;
        }
        resolve();
      },
    );
  });
}

async function ensureQuestionCrops(paper) {
  const totalQuestions = paper.totalQuestions || 40;
  const existing = readManifest(paper._id);
  const hasAllCrops = existing
    && existing.detectedQuestions?.length >= totalQuestions
    && existing.crops?.every((crop) => fs.existsSync(crop.file));

  if (hasAllCrops) return existing;

  await runCropper(paper);
  return readManifest(paper._id);
}

function toCropDTO(paperId, manifest, resource = 'library') {
  return {
    paperId: String(paperId),
    dpi: manifest.dpi,
    detectedQuestions: manifest.detectedQuestions || [],
    questions: (manifest.crops || []).map((crop) => ({
      question: crop.question,
      page: crop.page,
      box: crop.box,
      width: crop.pixelBox?.[2] - crop.pixelBox?.[0],
      height: crop.pixelBox?.[3] - crop.pixelBox?.[1],
      imageUrl: `/api/${resource}/${paperId}/crops/${crop.question}/image`,
    })),
  };
}

function getCropFile(manifest, questionNumber) {
  const crop = manifest?.crops?.find((item) => item.question === questionNumber);
  if (!crop || !fs.existsSync(crop.file)) return null;
  return crop.file;
}

module.exports = {
  ensureQuestionCrops,
  getCropFile,
  toCropDTO,
};

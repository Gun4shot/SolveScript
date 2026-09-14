require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const PaperLibrary = require('../models/PaperLibrary');
const { parseGradeThresholds, thresholdToDTO } = require('../services/gradeThresholdParser');

const STORAGE_ROOT = path.join(__dirname, '..', 'storage', 'papers', 'caie');

function thresholdPath(paper) {
  return path.join(STORAGE_ROOT, paper.syllabusCode, String(paper.year), paper.sessionCode, 'grade_threshold.pdf');
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGODB_URI);

  const papers = await PaperLibrary.find({ status: 'ready' })
    .select('_id syllabusCode year sessionCode component')
    .lean();
  const parsedByPath = new Map();
  const operations = [];

  for (const paper of papers) {
    const filePath = thresholdPath(paper);
    if (!fs.existsSync(filePath)) continue;
    if (!parsedByPath.has(filePath)) parsedByPath.set(filePath, await parseGradeThresholds(filePath));
    const componentThreshold = thresholdToDTO(parsedByPath.get(filePath).components?.[paper.component]);
    if (!componentThreshold) continue;
    operations.push({
      updateOne: {
        filter: { _id: paper._id },
        update: { $set: { gradeThresholdPath: filePath, componentThreshold, difficulty: componentThreshold.difficulty } },
      },
    });
  }

  if (!dryRun && operations.length) await PaperLibrary.bulkWrite(operations, { ordered: false });
  console.log(`${dryRun ? 'would update' : 'updated'} ${operations.length} of ${papers.length} Paper 1 records from ${parsedByPath.size} verified local threshold files.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  if (mongoose.connection.readyState) await mongoose.disconnect();
  process.exit(1);
});

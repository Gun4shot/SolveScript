require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const WrittenPaperLibrary = require('../models/WrittenPaperLibrary');
const { thresholdToDTO } = require('../services/gradeThresholdParser');

function normalizedThreshold(threshold) {
  if (!threshold?.maxRaw) return null;
  const sourceGrades = threshold.grades instanceof Map
    ? Object.fromEntries(threshold.grades)
    : threshold.grades || {};
  return thresholdToDTO({ maxRaw: Number(threshold.maxRaw), grades: sourceGrades });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGODB_URI);

  const papers = await WrittenPaperLibrary.find({ status: 'ready' })
    .select('_id componentThreshold difficulty')
    .lean();
  const operations = papers.map((paper) => {
    const componentThreshold = normalizedThreshold(paper.componentThreshold);
    const difficulty = componentThreshold?.difficulty || 'unknown';
    return {
      updateOne: {
        filter: { _id: paper._id },
        update: { $set: { componentThreshold, difficulty } },
      },
    };
  });

  if (!dryRun && operations.length) await WrittenPaperLibrary.bulkWrite(operations, { ordered: false });
  const classified = operations.filter((operation) => operation.updateOne.update.$set.difficulty !== 'unknown').length;
  console.log(`${dryRun ? 'would update' : 'updated'} ${operations.length} written papers; ${classified} have a threshold-based difficulty.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  if (mongoose.connection.readyState) await mongoose.disconnect();
  process.exit(1);
});

// A small reversible integration check. Never prints database credentials.
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const assert = require('node:assert/strict');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { storePrivatePdf, resolvePrivatePdf, deletePrivatePdf } = require('../services/paperFileStore');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'solvescript-storage-'));
  const local = path.join(directory, 'fixture.pdf');
  const fixture = '%PDF-1.7\nSolveScript storage verification\n%%EOF';
  let reference;
  try {
    process.env.UPLOAD_STORAGE = 'gridfs';
    await fs.writeFile(local, fixture);
    reference = await storePrivatePdf({ path: local }, 'deployment-storage-check');
    await fs.unlink(local);
    const restored = await resolvePrivatePdf(reference);
    assert.equal(await fs.readFile(restored, 'utf8'), fixture);
    await fs.unlink(restored);
    assert.equal(await fs.readFile(await resolvePrivatePdf(reference), 'utf8'), fixture);
    console.log('PASS: private PDF survives loss of original file and local cache.');
  } finally {
    if (reference) await deletePrivatePdf(reference);
    await fs.unlink(local).catch(() => {});
    await fs.rmdir(directory);
    await mongoose.disconnect();
  }
}

main().catch(async () => {
  console.error('Storage verification failed; check database connectivity and GridFS permissions.');
  await mongoose.disconnect();
  process.exitCode = 1;
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { writePdf, libraryRelativePath, libraryRemoteUrls, resolveLibraryPdf } = require('../services/paperFileStore');

test('rejects unsafe archive paths and source hosts', () => {
  assert.throws(() => libraryRelativePath({ syllabusCode: '../9702' }), /Invalid/);
  assert.equal(libraryRelativePath({ syllabusCode: '9702', year: 2025, sessionCode: 's', component: '11' }, 'question'), '9702/2025/s/11/question.pdf');
  const prefix = process.env.MCQ_HF_PREFIX;
  delete process.env.MCQ_HF_PREFIX;
  try {
    assert.deepEqual(libraryRemoteUrls({ questionPaperSourceUrl: 'https://127.0.0.1/private' }, 'question'), []);
  } finally {
    if (prefix !== undefined) process.env.MCQ_HF_PREFIX = prefix;
  }
});

test('stores a valid PDF atomically and discards an HTML error response', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'solvescript-pdf-'));
  const destination = path.join(directory, 'paper.pdf');
  try {
    await assert.rejects(writePdf(Readable.from(['<html>upstream error</html>']), destination), /did not return a PDF/);
    assert.deepEqual(await fs.readdir(directory), []);
    await writePdf(Readable.from(['%PDF-1.7\nfixture']), destination);
    assert.equal(await fs.readFile(destination, 'utf8'), '%PDF-1.7\nfixture');
  } finally {
    await fs.unlink(destination).catch(() => {});
    await fs.rmdir(directory);
  }
});

test('downloads only the selected paper and shares concurrent cache misses', async () => {
  const fetchBefore = global.fetch;
  const prefix = process.env.MCQ_HF_PREFIX;
  delete process.env.MCQ_HF_PREFIX;
  let requests = 0;
  global.fetch = async () => {
    requests += 1;
    return new Response('%PDF-1.7\nfixture', { headers: { 'content-type': 'application/pdf' } });
  };
  const paper = { syllabusCode: '9999', year: 2099, sessionCode: 's', component: '11', questionPaperPath: 'C:\\missing\\question.pdf', questionPaperSourceUrl: 'https://pastpapers.papacambridge.com/test.pdf' };
  let cached;
  try {
    const results = await Promise.all([resolveLibraryPdf(paper), resolveLibraryPdf(paper)]);
    cached = results[0];
    assert.equal(results[0], results[1]);
    assert.equal(requests, 1);
    assert.equal(await resolveLibraryPdf(paper), cached);
    assert.equal(requests, 1);
  } finally {
    global.fetch = fetchBefore;
    if (prefix !== undefined) process.env.MCQ_HF_PREFIX = prefix;
    if (cached) await fs.unlink(cached);
  }
});

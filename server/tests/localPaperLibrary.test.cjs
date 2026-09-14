const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  getLocalPapers,
  getLocalPaper,
} = require('../services/localPaperLibrary');

test('downloaded collection covers every supported subject from 2015 onwards', async () => {
  const papers = await getLocalPapers();
  for (const subject of ['Physics', 'Chemistry', 'Biology', 'Economics']) {
    for (let year = 2015; year <= 2025; year++) {
      assert.ok(
        papers.some(
          (paper) => paper.subject === subject && paper.year === year,
        ),
        `${subject} ${year} missing`,
      );
    }
  }
  assert.equal(new Set(papers.map((paper) => paper._id)).size, papers.length);
});

test('only complete answer keys and existing PDF pairs are exposed', async () => {
  for (const paper of await getLocalPapers()) {
    assert.ok(fs.existsSync(paper.questionPaperPath));
    assert.ok(fs.existsSync(paper.markingSchemePath));
    for (let q = 1; q <= paper.totalQuestions; q++) {
      assert.ok(
        /^[A-D]$/.test(paper.answers.get(String(q)) || '') ||
          paper.discountedQuestions.includes(q),
        `${paper._id}: answer ${q} missing`,
      );
    }
  }
});

test('downloaded grade thresholds are attached when available', async () => {
  const papers = await getLocalPapers();
  const withThreshold = papers.filter((paper) => paper.componentThreshold);
  assert.ok(withThreshold.length > 200);

  for (const paper of withThreshold.slice(0, 20)) {
    assert.equal(paper.componentThreshold.maxRaw, paper.totalQuestions);
    assert.ok(Number.isInteger(paper.componentThreshold.aMark));
    assert.ok(['hard', 'balanced', 'accessible'].includes(paper.difficulty));
  }
});

test('paper lookup uses catalog identifiers rather than arbitrary filesystem paths', async () => {
  const papers = await getLocalPapers();
  assert.equal(await getLocalPaper(papers[0]._id), papers[0]);
  assert.equal(await getLocalPaper('../../.env'), null);
  assert.equal(await getLocalPaper('local-9702-2015-s-99'), null);
});

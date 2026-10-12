const test = require('node:test');
const assert = require('node:assert/strict');
const {
  candidatePaths,
  hasUsableThreshold,
  resolveComponentThreshold,
} = require('../services/componentThreshold');

test('recognises complete component thresholds and rejects empty schema objects', () => {
  assert.equal(hasUsableThreshold({ maxRaw: 40, grades: { A: 29 } }), true);
  assert.equal(hasUsableThreshold({ grades: { A: 29 } }), false);
  assert.equal(hasUsableThreshold({ maxRaw: 40, grades: {} }), false);
});

test('uses a complete stored threshold without requiring a local file', async () => {
  const threshold = { maxRaw: 40, grades: { A: 29, B: 25, C: 21, D: 17, E: 13 } };
  assert.equal(await resolveComponentThreshold({ componentThreshold: threshold }), threshold);
});

test('adds the stable local threshold path when an older database record has none', () => {
  const paths = candidatePaths({ syllabusCode: '9702', year: 2025, sessionCode: 's' });
  assert.ok(paths.some((item) => item.replace(/\\/g, '/').endsWith('storage/papers/caie/9702/2025/s/grade_threshold.pdf')));
});

test('fills an incomplete database record from its matching local threshold file', async () => {
  const threshold = await resolveComponentThreshold({
    syllabusCode: '9702',
    year: 2025,
    sessionCode: 's',
    component: '11',
    componentThreshold: { grades: {} },
  });

  assert.deepEqual(threshold, {
    maxRaw: 40,
    grades: { A: 29, B: 26, C: 22, D: 19, E: 16 },
    aMark: 29,
    aPercent: 73,
    difficulty: 'balanced',
  });
});

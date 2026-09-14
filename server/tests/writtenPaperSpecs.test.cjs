const test = require('node:test');
const assert = require('node:assert/strict');
const { WRITTEN_PAPER_SPECS, expectedPaperNumbers, getWrittenPaperSpec } = require('../config/writtenPaperSpecs');

test('written-paper catalog includes every planned first-release component', () => {
  const required = {
    9700: ['2', '4', '5'],
    9701: ['2', '4', '5'],
    9702: ['2', '4', '5'],
    9708: ['2', '4'],
    9709: ['1', '3', '4', '5', '6'],
    9231: ['1', '2', '3', '4'],
  };

  for (const [syllabusCode, paperNumbers] of Object.entries(required)) {
    for (const paperNumber of paperNumbers) {
      const spec = getWrittenPaperSpec(syllabusCode, `${paperNumber}2`);
      assert.ok(spec, `${syllabusCode} paper ${paperNumber} should be supported`);
      assert.ok(spec.durationMinutes > 0);
      assert.ok(spec.totalMarks > 0);
    }
  }
});

test('science Paper 3 is not mistakenly added to the annotatable written catalog', () => {
  for (const syllabusCode of ['9700', '9701', '9702']) {
    assert.equal(getWrittenPaperSpec(syllabusCode, '32'), null);
  }
});

test('written-paper specs are unique by syllabus and paper number', () => {
  const keys = WRITTEN_PAPER_SPECS.map((spec) => `${spec.syllabusCode}:${spec.paperNumber}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('component collections include Paper 1 only for subjects with a Paper 1 MCQ component', () => {
  assert.deepEqual(expectedPaperNumbers('9702'), ['1', '2', '4', '5']);
  assert.deepEqual(expectedPaperNumbers('9708'), ['1', '2', '4']);
  assert.deepEqual(expectedPaperNumbers('9709'), ['1', '3', '4', '5', '6']);
});

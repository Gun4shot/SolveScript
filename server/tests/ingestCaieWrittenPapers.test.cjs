const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTasks, parseArgs } = require('../scripts/ingestCaieWrittenPapers');

test('written-paper ingestion only produces configured written components', () => {
  const options = parseArgs(['--years', '2025', '--subjects', '9702,9709']);
  const components = buildTasks(options).map((task) => `${task.syllabusCode}/${task.component}`);
  assert.ok(components.includes('9702/22'));
  assert.ok(components.includes('9702/42'));
  assert.ok(components.includes('9702/52'));
  assert.ok(components.includes('9709/12'));
  assert.ok(components.includes('9709/62'));
  assert.ok(!components.some((value) => value.startsWith('9702/3')));
});

test('ingestion flags are narrow and reproducible', () => {
  const options = parseArgs(['--years', '2025', '--subjects', '9702', '--papers', '2', '--limit', '2', '--dry-run']);
  const tasks = buildTasks(options);
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((task) => task.syllabusCode === '9702' && task.spec.paperNumber === '2'));
  assert.equal(options.dryRun, true);
});

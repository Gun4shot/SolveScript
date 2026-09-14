import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, formatDuration, gradeForScore } from './attemptReport.js';

const threshold = {
  maxRaw: 40,
  grades: { A: 28, B: 24, C: 20, D: 17, E: 13 },
};

test('formatDuration renders mm:ss', () => {
  assert.equal(formatDuration(75), '01:15');
  assert.equal(formatDuration(-10), '00:00');
});

test('gradeForScore maps raw component marks to threshold grade', () => {
  assert.equal(gradeForScore(31, threshold), 'A');
  assert.equal(gradeForScore(24, threshold), 'B');
  assert.equal(gradeForScore(12, threshold), 'U');
  assert.equal(gradeForScore(20, null), null);
});

test('buildReport includes mistakes, timing, accuracy, and component grade', () => {
  const report = buildReport({
    totalQuestions: 4,
    selectedAnswers: { 1: 'A', 2: 'C', 4: 'D' },
    correctAnswers: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
    questionTimes: { 1: 12.2, 2: 20, 4: 10 },
    totalTimeTaken: 90,
    componentThreshold: {
      maxRaw: 4,
      grades: { A: 4, B: 3, C: 2, D: 1, E: 0 },
    },
  });

  assert.equal(report.totalCorrect, 2);
  assert.equal(report.totalWrong, 1);
  assert.equal(report.totalSkipped, 1);
  assert.equal(report.accuracy, 67);
  assert.equal(report.averageTime, 30);
  assert.equal(report.grade.value, 'C');
  assert.equal(report.answers[2].isCorrect, false);
});

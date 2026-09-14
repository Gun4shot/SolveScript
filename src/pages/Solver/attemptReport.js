export function formatDuration(seconds = 0) {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}

export function gradeForScore(score, threshold) {
  if (!threshold?.grades || !Number.isFinite(score)) return null;
  for (const grade of ['A', 'B', 'C', 'D', 'E']) {
    const mark = threshold.grades[grade];
    if (Number.isFinite(mark) && score >= mark) return grade;
  }
  return 'U';
}

export function buildReport({ totalQuestions, selectedAnswers, correctAnswers, discountedQuestions = [], questionTimes = {}, totalTimeTaken = 0, componentThreshold = null }) {
  const excluded = new Set(discountedQuestions.map(Number));
  const answers = {};
  let totalCorrect = 0, totalWrong = 0, totalSkipped = 0, totalUngraded = 0;
  for (let q = 1; q <= totalQuestions; q += 1) {
    const selected = selectedAnswers[q] || null;
    const correct = correctAnswers[q] || null;
    const discounted = excluded.has(q);
    const isCorrect = !!selected && !!correct && selected.toUpperCase() === correct.toUpperCase();
    if (!discounted) {
      if (!correct) totalUngraded += 1;
      else if (!selected) totalSkipped += 1;
      else if (isCorrect) totalCorrect += 1;
      else totalWrong += 1;
    }
    answers[q] = { selected, correct: discounted ? 'Discounted' : correct || 'N/A', isCorrect, discounted, ungraded: !correct, timeSpent: Math.max(0, Math.round(questionTimes[q] || 0)) };
  }
  const gradeableTotal = totalCorrect + totalWrong + totalSkipped;
  const attempted = Object.values(answers).filter((a) => a.selected && !a.discounted).length;
  const grade = componentThreshold && gradeableTotal
    ? {
      value: gradeForScore(totalCorrect, componentThreshold),
      score: totalCorrect,
      threshold: componentThreshold,
    }
    : null;

  return { answers, totalCorrect, totalWrong, totalSkipped, totalUngraded, gradeableTotal, attempted,
    percentage: gradeableTotal ? Math.round(totalCorrect / gradeableTotal * 100) : null,
    accuracy: totalCorrect + totalWrong ? Math.round(totalCorrect / (totalCorrect + totalWrong) * 100) : null,
    totalTimeTaken, averageTime: attempted ? totalTimeTaken / attempted : null, grade };
}

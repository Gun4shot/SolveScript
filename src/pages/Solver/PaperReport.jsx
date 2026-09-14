import { useState } from 'react';
import { CheckCircle2, Clock3, Gauge, Target, ArrowRight } from 'lucide-react';
import StudioDialog from '../../components/studio/StudioDialog';
import { formatDuration } from './attemptReport';

export default function PaperReport({ result, title, onClose, onReview, onDashboard }) {
  const [filter, setFilter] = useState('mistakes');
  const rows = Object.entries(result.answers).filter(([, answer]) => filter === 'all' || (!answer.isCorrect && !answer.discounted && !answer.ungraded));
  const thresholdEntries = result.grade?.threshold?.grades
    ? Object.entries(result.grade.threshold.grades).filter(([, mark]) => Number.isFinite(Number(mark)))
    : [];
  return <StudioDialog title="Paper report" onClose={onClose} className="paper-report">
    <header className="report-heading"><img src="/characters/theo-tally.png" alt="Theo Tally" /><div><span className="small-label">SESSION COMPLETE</span><h2>Your paper, in perspective.</h2><p>{title}</p></div></header>
    <div className="report-score"><strong>{result.percentage === null ? 'Unmarked' : `${result.percentage}%`}</strong><span>{result.gradeableTotal ? `${result.totalCorrect} of ${result.gradeableTotal} graded questions correct` : 'No answer key is available for this paper.'}</span></div>
    <section className="report-grade-band" aria-label="Grade threshold result">
      <div>
        <span><Gauge size={16} />Component grade</span>
        <b>{result.grade?.value || 'Threshold unavailable'}</b>
        <small>{result.grade ? `${result.grade.score} raw marks against this component's thresholds` : 'Download thresholds for this paper to show component grades.'}</small>
      </div>
      {!!thresholdEntries.length && (
        <ol>
          {thresholdEntries.map(([grade, mark]) => (
            <li key={grade} className={result.grade?.value === grade ? 'is-hit' : ''}>
              <span>{grade}</span>
              <b>{mark}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
    <dl className="report-metrics">
      <div><dt><Target size={16} />Accuracy</dt><dd>{result.accuracy === null ? '--' : `${result.accuracy}%`}</dd><small>of graded answers attempted</small></div>
      <div><dt><Clock3 size={16} />Time taken</dt><dd>{formatDuration(result.totalTimeTaken)}</dd><small>minutes : seconds</small></div>
      <div><dt><Clock3 size={16} />Average / question</dt><dd>{result.averageTime === null ? '--' : formatDuration(result.averageTime)}</dd><small>total time / attempted questions</small></div>
      <div><dt><CheckCircle2 size={16} />Attempted</dt><dd>{result.attempted}</dd><small>{result.totalWrong} incorrect / {result.totalSkipped} skipped</small></div>
    </dl>
    <div className="report-list-head"><h3>Question breakdown</h3><div className="review-tabs">{['mistakes', 'all'].map((value) => <button key={value} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All questions' : 'Mistakes & skipped'}</button>)}</div></div>
    <div className="report-table-scroll"><table><thead><tr><th>Question</th><th>Your answer</th><th>Correct answer</th><th>Time</th><th>Result</th></tr></thead><tbody>{rows.map(([q, answer]) => <tr key={q}><th scope="row">{q}</th><td>{answer.selected || '--'}</td><td>{answer.correct}</td><td>{formatDuration(answer.timeSpent)}</td><td className={answer.isCorrect ? 'report-correct' : 'report-incorrect'}>{answer.discounted ? 'Discounted' : answer.ungraded ? 'Unmarked' : answer.isCorrect ? 'Correct' : answer.selected ? 'Incorrect' : 'Skipped'}</td></tr>)}</tbody></table>{!rows.length && <p className="report-empty">{result.totalUngraded ? 'No marked mistakes are available without an answer key.' : 'No mistakes to review. Nicely done.'}</p>}</div>
    <footer className="report-actions"><button className="btn btn-secondary" onClick={onReview}>Review paper</button><button className="btn btn-primary" onClick={onDashboard}>My dashboard <ArrowRight size={16} /></button></footer>
  </StudioDialog>;
}

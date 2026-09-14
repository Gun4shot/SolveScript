import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  LineChart,
  PieChart,
  Target,
} from 'lucide-react';
import { useStudyData } from '../../components/studio/studyData';
import './AnalyticsPage.css';

const AVATAR_SRC = '/characters/theo-tally.png';

const subjectTone = {
  Physics: 'blue',
  Chemistry: 'coral',
  Biology: 'mint',
  Economics: 'yellow',
  General: 'blue',
};

const cleanSubject = (subject = 'General') =>
  subject.replace(/^A-Level\s+/i, '');

function formatTime(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function makeSubjectStats(attempts) {
  const subjects = new Map();

  attempts.forEach((attempt) => {
    const subject = cleanSubject(attempt.paper?.subject || 'General');
    const current = subjects.get(subject) || {
      subject,
      tests: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      time: 0,
      scoreTotal: 0,
      best: 0,
    };

    current.tests += 1;
    current.correct += attempt.totalCorrect || 0;
    current.wrong += attempt.totalWrong || 0;
    current.skipped += attempt.totalSkipped || 0;
    current.time += attempt.totalTimeTaken || 0;
    current.scoreTotal += attempt.percentage || 0;
    current.best = Math.max(current.best, attempt.percentage || 0);
    subjects.set(subject, current);
  });

  return Array.from(subjects.values())
    .map((item) => ({
      ...item,
      attempted: item.correct + item.wrong,
      accuracy:
        item.correct + item.wrong
          ? Math.round((item.correct / (item.correct + item.wrong)) * 100)
          : 0,
    }))
    .sort((a, b) => b.tests - a.tests);
}

function makeTrendPoints(attempts) {
  const ordered = [...attempts]
    .filter((attempt) => attempt.completedAt || attempt.createdAt)
    .sort(
      (a, b) =>
        new Date(a.completedAt || a.createdAt) -
        new Date(b.completedAt || b.createdAt),
    )
    .slice(-8);

  if (ordered.length < 2) return '';

  return ordered
    .map((attempt, index) => {
      const x = 12 + (index / (ordered.length - 1)) * 276;
      const y = 112 - ((attempt.percentage || 0) / 100) * 92;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function AnalyticsPage() {
  const { attempts: allAttempts, loading, error: loadError } = useStudyData();
  const [subject, setSubject] = useState('All subjects');
  const [period, setPeriod] = useState('all');
  const attempts = useMemo(
    () =>
      allAttempts.filter(
        (attempt) =>
          (subject === 'All subjects' ||
            cleanSubject(attempt.paper?.subject) === subject) &&
          (period === 'all' ||
            new Date(attempt.completedAt) >=
              new Date(
                new Date().setDate(new Date().getDate() - Number(period)),
              )),
      ),
    [allAttempts, subject, period],
  );

  const subjectStats = useMemo(() => makeSubjectStats(attempts), [attempts]);
  const totalPapers = attempts.length;
  const totalAttempted = attempts.reduce(
    (sum, attempt) =>
      sum + (attempt.totalCorrect || 0) + (attempt.totalWrong || 0),
    0,
  );
  const avgAccuracy = totalAttempted
    ? Math.round(
        (attempts.reduce(
          (sum, attempt) => sum + (attempt.totalCorrect || 0),
          0,
        ) /
          totalAttempted) *
          100,
      )
    : 0;
  const bestScore = totalPapers
    ? Math.max(...attempts.map((attempt) => attempt.percentage || 0))
    : 0;
  const totalTime = attempts.reduce(
    (sum, attempt) => sum + (attempt.totalTimeTaken || 0),
    0,
  );
  const trendPoints = makeTrendPoints(attempts);
  const latestFinished = attempts.slice(0, 5);

  return (
    <main className="analytics-page">
      <div className="analytics-bg" aria-hidden="true" />
      <div className="container analytics-shell">
        <section className="analytics-hero" aria-labelledby="analytics-title">
          <div>
            <span className="dash-kicker">
              <BarChart3 size={15} aria-hidden="true" /> Analytics
            </span>
            <h1 id="analytics-title">
              Look how far
              <br />
              <em>you can go.</em>
            </h1>
            <p>Every paper leaves a little evidence of progress.</p>
          </div>
          <img src={AVATAR_SRC} alt="" className="analytics-avatar" />
        </section>

        <div className="analytics-controls">
          <div className="analytics-tabs" aria-label="Subject filter">
            {[
              'All subjects',
              'Physics',
              'Chemistry',
              'Biology',
              'Economics',
            ].map((item) => (
              <button
                key={item}
                aria-pressed={subject === item}
                className={subject === item ? 'active' : ''}
                onClick={() => setSubject(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <select
            aria-label="Progress date range"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="all">All time</option>
            <option value="30">Last 30 days</option>
            <option value="7">Last 7 days</option>
          </select>
        </div>
        {loadError && (
          <p role="status" className="studio-notice">
            {loadError}
          </p>
        )}

        <section className="analytics-metric-grid" aria-busy={loading}>
          <article>
            <BookOpen size={18} aria-hidden="true" />
            <b>{totalPapers}</b>
            <span>Past papers done</span>
          </article>
          <article>
            <Target size={18} aria-hidden="true" />
            <b>{avgAccuracy}%</b>
            <span>Answer accuracy</span>
          </article>
          <article>
            <CheckCircle2 size={18} aria-hidden="true" />
            <b>{totalAttempted}</b>
            <span>Questions attempted</span>
          </article>
          <article>
            <Clock3 size={18} aria-hidden="true" />
            <b>{formatTime(totalTime)}</b>
            <span>Total study time</span>
          </article>
        </section>

        <section className="analytics-layout">
          <section
            className="analytics-panel trend-panel"
            aria-labelledby="trend-title"
          >
            <div className="analytics-heading">
              <div>
                <span className="small-label">THE MARKS YOU MAKE</span>
                <h2 id="trend-title">Your score, over time</h2>
              </div>
              <LineChart size={19} aria-hidden="true" />
            </div>
            <div className="trend-chart" aria-label="Recent paper scores">
              {trendPoints ? (
                <svg
                  viewBox="0 0 300 126"
                  role="img"
                  aria-label="Scores for your last eight papers, oldest to newest"
                >
                  <title>
                    Paper score trend. Exact scores are listed in finished
                    papers below.
                  </title>
                  <path d="M12 20H288 M12 66H288 M12 112H288" />
                  <polyline points={trendPoints} />
                  {trendPoints.split(' ').map((point) => {
                    const [cx, cy] = point.split(',');
                    return <circle key={point} cx={cx} cy={cy} r="4.5" />;
                  })}
                </svg>
              ) : (
                <div className="chart-empty">
                  <span className="empty-trend-lines" aria-hidden="true" />
                  <b>Your story is still being written.</b>
                  <span>Finish two papers to see your score trend.</span>
                  <Link to="/library" className="studio-text-button">
                    Make your first mark <ArrowRight size={15} />
                  </Link>
                </div>
              )}
            </div>
            <div className="chart-axis">
              <span>Earlier papers</span>
              <span>Most recent</span>
            </div>
          </section>

          <aside
            className="analytics-panel best-panel"
            aria-labelledby="best-title"
          >
            <div className="analytics-heading">
              <div>
                <span className="small-label">Best</span>
                <h2 id="best-title">Top score</h2>
              </div>
              <PieChart size={19} aria-hidden="true" />
            </div>
            <div
              className="score-ring"
              style={{ '--score': `${bestScore * 3.6}deg` }}
            >
              <span>{bestScore}%</span>
            </div>
          </aside>

          <section
            className="analytics-panel subjects-analytics"
            aria-labelledby="subject-analytics-title"
          >
            <div className="analytics-heading">
              <div>
                <span className="small-label">By subject</span>
                <h2 id="subject-analytics-title">A subject at a time.</h2>
              </div>
            </div>
            <div className="subject-analytics-list">
              {subjectStats.map((item) => {
                const tone = subjectTone[item.subject] || 'blue';
                const totalAnswers = Math.max(
                  item.correct + item.wrong + item.skipped,
                  1,
                );
                return (
                  <article className="subject-analytics-row" key={item.subject}>
                    <div className="subject-row-top">
                      <span className={`subject-badge tone-${tone}`}>
                        {item.subject.slice(0, 3)}
                      </span>
                      <div>
                        <b>{item.subject}</b>
                        <small>
                          {item.tests} finished / {item.attempted} attempted /{' '}
                          {formatTime(item.time)}
                        </small>
                      </div>
                      <strong>{item.accuracy}%</strong>
                    </div>
                    <div
                      className="stacked-bar"
                      role="img"
                      aria-label={`${item.subject}: ${item.correct} correct, ${item.wrong} wrong, ${item.skipped} skipped`}
                    >
                      <span
                        className="correct"
                        style={{
                          width: `${(item.correct / totalAnswers) * 100}%`,
                        }}
                      />
                      <span
                        className="wrong"
                        style={{
                          width: `${(item.wrong / totalAnswers) * 100}%`,
                        }}
                      />
                      <span
                        className="skipped"
                        style={{
                          width: `${(item.skipped / totalAnswers) * 100}%`,
                        }}
                      />
                    </div>
                  </article>
                );
              })}
              {!subjectStats.length && !loading && (
                <div className="analytics-empty">
                  <img src="/characters/sana-solve.png" alt="Sana Solve" />
                  <b>{loadError || 'Your first paper is a starting point.'}</b>
                  <Link to="/library" className="btn btn-primary">
                    Start a paper <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
            <div className="answer-legend">
              <span>
                <i />
                Correct
              </span>
              <span>
                <i />
                Incorrect
              </span>
              <span>
                <i />
                Skipped
              </span>
            </div>
          </section>

          <aside
            className="analytics-panel finished-panel"
            aria-labelledby="finished-title"
          >
            <div className="analytics-heading">
              <div>
                <span className="small-label">Finished</span>
                <h2 id="finished-title">Finished papers</h2>
              </div>
            </div>
            <div className="finished-list">
              {latestFinished.map((attempt) => (
                <Link
                  to={`/results/${attempt.id}`}
                  className="finished-row"
                  key={attempt.id}
                >
                  <span>{attempt.percentage || 0}%</span>
                  <b>{attempt.paper?.title || 'Untitled paper'}</b>
                  <small>
                    {cleanSubject(attempt.paper?.subject)} / {attempt.mode}
                  </small>
                </Link>
              ))}
              {!latestFinished.length && !loading && (
                <small className="muted-line">
                  A home for every paper you finish.
                </small>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

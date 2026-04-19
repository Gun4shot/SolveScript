import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { attemptsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './ResultsPage.css';

export default function ResultsPage() {
  const { attemptId } = useParams();
  const toast = useToast();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await attemptsAPI.getOne(attemptId);
        setAttempt(res.data.attempt);
      } catch (err) {
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [attemptId]);

  if (loading) return <div className="solver-loading"><div className="spinner spinner-lg" /><p className="text-secondary">Loading results...</p></div>;
  if (!attempt) return <div className="solver-loading"><p className="text-secondary">Results not found</p></div>;

  const answers = attempt.answers || {};
  const answeredQuestions = Object.entries(answers).filter(([_, a]) => a.selected);
  const correctList = Object.entries(answers).filter(([_, a]) => a.isCorrect);
  const wrongList = Object.entries(answers).filter(([_, a]) => a.selected && !a.isCorrect);
  const skippedList = Object.entries(answers).filter(([_, a]) => !a.selected);

  const formatTime = (s) => {
    if (!s || s === 0) return '0s';
    const mins = Math.floor(s / 60);
    const secs = Math.round(s % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="results-page">
      <div className="container">
        <div className="results-header animate-fade-in-up">
          <Link to="/dashboard" className="btn btn-ghost btn-sm">← Back to Dashboard</Link>
          <h1>{attempt.paper?.title || 'Paper Results'}</h1>
          <div className="results-meta">
            {attempt.paper?.subject && <span className="badge badge-accent">{attempt.paper.subject}</span>}
            <span className="badge badge-info">{attempt.mode} mode</span>
          </div>
        </div>

        {/* Score Card */}
        <div className="score-section animate-fade-in-up stagger-1">
          <div className="score-card glass-card">
            <div className="score-circle-wrapper">
              <svg className="score-circle" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bg-tertiary)" strokeWidth="8"/>
                <circle cx="60" cy="60" r="52" fill="none" stroke="url(#scoreGrad)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(attempt.percentage / 100) * 327} 327`}
                  transform="rotate(-90 60 60)" className="score-progress"/>
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1"/>
                    <stop offset="100%" stopColor="#a78bfa"/>
                  </linearGradient>
                </defs>
              </svg>
              <div className="score-number">
                <span className="score-pct">{attempt.percentage}%</span>
                <span className="score-fraction">{attempt.totalCorrect}/40</span>
              </div>
            </div>
          </div>

          <div className="stats-cards">
            <div className="stat-card card">
              <div className="stat-icon correct-icon">✓</div>
              <div className="stat-info">
                <span className="stat-value">{attempt.totalCorrect}</span>
                <span className="stat-label">Correct</span>
              </div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon wrong-icon">✕</div>
              <div className="stat-info">
                <span className="stat-value">{attempt.totalWrong}</span>
                <span className="stat-label">Wrong</span>
              </div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon skipped-icon">—</div>
              <div className="stat-info">
                <span className="stat-value">{attempt.totalSkipped}</span>
                <span className="stat-label">Skipped</span>
              </div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon time-icon">⏱</div>
              <div className="stat-info">
                <span className="stat-value">{formatTime(attempt.totalTimeTaken)}</span>
                <span className="stat-label">Total Time</span>
              </div>
            </div>
          </div>
        </div>

        {/* Question Breakdown */}
        <div className="breakdown-section card animate-fade-in-up stagger-2">
          <h2 style={{ marginBottom: 'var(--space-5)' }}>Question Breakdown</h2>
          <div className="breakdown-list">
            {Array.from({ length: 40 }, (_, i) => i + 1).map(q => {
              const a = answers[q] || {};
              const status = !a.selected ? 'skipped' : a.isCorrect ? 'correct' : 'wrong';
              return (
                <div key={q} className={`breakdown-row ${status}`}>
                  <span className="breakdown-num">{q}</span>
                  <span className="breakdown-your">{a.selected || '—'}</span>
                  <span className="breakdown-correct">{a.correct}</span>
                  <span className="breakdown-time">{formatTime(a.timeSpent)}</span>
                  <span className={`breakdown-status ${status}`}>
                    {status === 'correct' ? '✓' : status === 'wrong' ? '✕' : '—'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="breakdown-legend">
            <span><strong>Your Answer</strong></span>
            <span><strong>Correct</strong></span>
            <span><strong>Time</strong></span>
            <span><strong>Status</strong></span>
          </div>
        </div>

        <div className="results-actions animate-fade-in-up">
          <Link to="/dashboard" className="btn btn-secondary btn-lg">Dashboard</Link>
          <Link to="/upload" className="btn btn-primary btn-lg">Solve Another Paper</Link>
        </div>
      </div>
    </div>
  );
}

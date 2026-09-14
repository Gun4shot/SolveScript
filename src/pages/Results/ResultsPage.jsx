import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { attemptsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { accountKey, readSaved } from '../../components/studio/studyData';
import './ResultsPage.css';

export default function ResultsPage() {
  const { attemptId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (attemptId.startsWith('local-')) {
          const saved = readSaved(`solvescript:attempts:${accountKey(user)}`, []);
          setAttempt(Array.isArray(saved) ? saved.find((item) => item.id === attemptId) || null : null);
          return;
        }
        const res = await attemptsAPI.getOne(attemptId);
        setAttempt(res.data.attempt);
      } catch {
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [attemptId, toast, user]);

  if (loading) return <div className="solver-loading"><div className="spinner spinner-lg" /><p className="text-secondary">Loading results...</p></div>;
  if (!attempt) return <div className="solver-loading"><p className="text-secondary">We could not find those results. They may have been removed or saved in a different browser session.</p><div className="results-actions"><Link to="/dashboard" className="btn btn-secondary">Back to dashboard</Link><Link to="/library" className="btn btn-primary">Choose a paper</Link></div></div>;

  const answers = attempt.answers || {};

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
          <div className="breakdown-legend">
            <span><strong>Your answer</strong></span>
            <span><strong>Correct</strong></span>
            <span><strong>Time</strong></span>
            <span><strong>Status</strong></span>
          </div>
          <div className="breakdown-list">
            {Object.keys(answers).map(Number).sort((a, b) => a - b).map(q => {
              const a = answers[q] || {};
              const status = !a.selected ? 'skipped' : a.isCorrect ? 'correct' : 'wrong';
              return (
                <div key={q} className={`breakdown-row ${status}`}>
                  <span className="breakdown-num">{q}</span>
                  <span className="breakdown-your">{a.selected || '—'}</span>
                  <span className="breakdown-correct">{a.correct}</span>
                  <span className="breakdown-time">{formatTime(a.timeSpent)}</span>
                  <span className={`breakdown-status ${status}`}>
                    <span aria-hidden="true">{status === 'correct' ? '✓' : status === 'wrong' ? '✕' : '—'}</span><span className="sr-only">{status}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="results-actions animate-fade-in-up">
          <Link to="/dashboard" className="btn btn-secondary btn-lg">Dashboard</Link>
          <Link to="/library" className="btn btn-primary btn-lg">Solve Another Paper</Link>
        </div>
      </div>
    </div>
  );
}

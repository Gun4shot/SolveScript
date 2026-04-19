import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { attemptsAPI } from '../../services/api';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalPapers: 0, avgScore: 0, bestScore: 0, totalStudyTime: 0 });
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, attemptsRes] = await Promise.all([attemptsAPI.getStats(), attemptsAPI.getAll()]);
        setStats(statsRes.data.stats);
        setRecentAttempts(attemptsRes.data.attempts.slice(0, 5));
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatTime = (s) => {
    if (!s) return '0m';
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="dashboard-page page">
      <div className="container">
        <div className="dash-welcome animate-fade-in-up">
          <div>
            <h1>Welcome back, <span className="text-gradient">{user?.name?.split(' ')[0]}</span></h1>
            <p className="text-secondary">Track your progress and solve more papers</p>
          </div>
          <Link to="/upload" className="btn btn-primary btn-lg">
            + New Paper
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="dash-stats animate-fade-in-up stagger-1">
          <div className="dash-stat-card glass-card">
            <span className="dash-stat-value text-gradient">{stats.totalPapers}</span>
            <span className="dash-stat-label">Papers Solved</span>
          </div>
          <div className="dash-stat-card glass-card">
            <span className="dash-stat-value text-gradient">{stats.avgScore}%</span>
            <span className="dash-stat-label">Average Score</span>
          </div>
          <div className="dash-stat-card glass-card">
            <span className="dash-stat-value text-gradient">{stats.bestScore}%</span>
            <span className="dash-stat-label">Best Score</span>
          </div>
          <div className="dash-stat-card glass-card">
            <span className="dash-stat-value text-gradient">{formatTime(stats.totalStudyTime)}</span>
            <span className="dash-stat-label">Study Time</span>
          </div>
        </div>

        {/* Recent Attempts */}
        <div className="dash-recent card animate-fade-in-up stagger-2">
          <div className="dash-recent-header">
            <h2>Recent Papers</h2>
            <Link to="/history" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : recentAttempts.length === 0 ? (
            <div className="dash-empty">
              <p className="text-secondary">No papers solved yet. Upload your first paper to get started!</p>
              <Link to="/upload" className="btn btn-primary">Upload Paper</Link>
            </div>
          ) : (
            <div className="dash-attempts-list">
              {recentAttempts.map(a => (
                <Link to={`/results/${a.id}`} key={a.id} className="dash-attempt-row">
                  <div className="dash-attempt-info">
                    <span className="dash-attempt-title">{a.paper?.title || 'Untitled'}</span>
                    <span className="dash-attempt-meta text-secondary">
                      {a.paper?.subject && `${a.paper.subject} · `}
                      {a.mode} · {new Date(a.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="dash-attempt-score">
                    <span className={`score-badge ${a.percentage >= 70 ? 'good' : a.percentage >= 50 ? 'ok' : 'low'}`}>
                      {a.percentage}%
                    </span>
                    <span className="text-secondary" style={{ fontSize: '0.8rem' }}>{a.totalCorrect}/40</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

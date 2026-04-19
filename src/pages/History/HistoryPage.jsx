import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { attemptsAPI } from '../../services/api';
import './HistoryPage.css';

export default function HistoryPage() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await attemptsAPI.getAll();
        setAttempts(res.data.attempts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = attempts.filter(a => {
    if (filter !== 'all' && a.mode !== filter) return false;
    if (search && a.paper?.title && !a.paper.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatTime = (s) => {
    if (!s) return '—';
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="history-page page">
      <div className="container">
        <div className="history-header animate-fade-in-up">
          <h1>Paper History</h1>
          <p className="text-secondary">View all your past solved papers</p>
        </div>

        <div className="history-filters animate-fade-in-up stagger-1">
          <input className="input" placeholder="Search papers..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '300px' }} />
          <div className="filter-tabs">
            {['all', 'exam', 'casual'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <p className="text-secondary">No papers found.</p>
            <Link to="/upload" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>Upload Paper</Link>
          </div>
        ) : (
          <div className="history-list animate-fade-in-up stagger-2">
            {filtered.map(a => (
              <Link to={`/results/${a.id}`} key={a.id} className="history-item card">
                <div className="history-item-main">
                  <h3>{a.paper?.title || 'Untitled'}</h3>
                  <div className="history-item-meta">
                    {a.paper?.subject && <span className="badge badge-accent">{a.paper.subject}</span>}
                    <span className="badge badge-info">{a.mode}</span>
                    <span className="text-secondary">{new Date(a.completedAt).toLocaleDateString()}</span>
                    <span className="text-secondary">{formatTime(a.totalTimeTaken)}</span>
                  </div>
                </div>
                <div className="history-item-score">
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
  );
}

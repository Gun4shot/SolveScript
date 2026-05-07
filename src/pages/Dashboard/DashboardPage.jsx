import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout, Clock, Target, Plus, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { attemptsAPI } from '../../services/api';

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
        setRecentAttempts(attemptsRes.data.attempts.slice(0, 4));
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

  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface py-12 px-6 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Welcome Section */}
        <motion.div 
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">
              Good morning, <span className="text-accent">{user?.name?.split(' ')[0]}</span>
            </h1>
            <p className="text-secondary">Track your progress and dive back into solving.</p>
          </div>
          <Link to="/upload" className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accentHover text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-soft hover:shadow-md">
            <Plus size={20} />
            Solve New Paper
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {[
            { label: 'Papers Solved', value: stats.totalPapers, icon: FileText },
            { label: 'Average Score', value: `${stats.avgScore}%`, icon: Target },
            { label: 'Best Score', value: `${stats.bestScore}%`, icon: Target },
            { label: 'Time Spent', value: formatTime(stats.totalStudyTime), icon: Clock },
          ].map((stat, idx) => (
            <motion.div key={idx} variants={fadeUp} className="bg-white border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-indigo-50 text-accent rounded-xl flex items-center justify-center mb-4 border border-indigo-100">
                <stat.icon size={20} />
              </div>
              <div className="text-2xl font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-sm font-medium text-secondary">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Papers */}
        <motion.div 
          className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="px-8 py-6 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">Recent Papers</h2>
            <Link to="/history" className="text-sm font-medium text-accent hover:text-accentHover flex items-center gap-1 transition-colors">
              View All <ChevronRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-surface border-t-accent rounded-full animate-spin" />
            </div>
          ) : recentAttempts.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-secondary">
                <Layout size={32} />
              </div>
              <p className="text-lg font-medium text-primary mb-2">No papers solved yet</p>
              <p className="text-secondary mb-6">Upload your first past paper to get started.</p>
              <Link to="/upload" className="inline-flex items-center justify-center bg-white border border-border text-primary hover:bg-surface px-6 py-2 rounded-lg font-medium transition-colors">
                Upload Paper
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentAttempts.map(a => (
                <Link to={`/results/${a.id}`} key={a.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 hover:bg-surface transition-colors group">
                  <div className="mb-4 sm:mb-0">
                    <h3 className="font-bold text-primary group-hover:text-accent transition-colors mb-2">
                      {a.paper?.title || 'Untitled Paper'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
                      {a.paper?.subject && (
                        <span className="px-2 py-1 bg-indigo-50 text-accent rounded-md font-medium text-xs border border-indigo-100">
                          {a.paper.subject}
                        </span>
                      )}
                      <span className="capitalize px-2 py-1 bg-white border border-border rounded-md font-medium text-xs">{a.mode}</span>
                      <span>{new Date(a.completedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-secondary">Score</div>
                      <div className="font-bold text-primary">{a.totalCorrect}/40</div>
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-4 ${
                      a.percentage >= 80 ? 'border-success text-success bg-emerald-50' : 
                      a.percentage >= 60 ? 'border-amber-400 text-amber-600 bg-amber-50' : 
                      'border-error text-error bg-red-50'
                    }`}>
                      {a.percentage}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}

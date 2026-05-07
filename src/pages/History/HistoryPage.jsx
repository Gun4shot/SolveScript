import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, MoreVertical, FileText, Clock, Target, Calendar, Layout, Trash2, Edit3, Eye, Pencil } from 'lucide-react';
import { attemptsAPI, papersAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function HistoryPage() {
  const toast = useToast();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await attemptsAPI.getAll();
        setAttempts(res.data.attempts);
      } catch (err) {
        toast.error('Failed to load history');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = attempts
    .filter(a => {
      const matchesSearch = (a.paper?.title || '').toLowerCase().includes(search.toLowerCase());
      const matchesMode = filterMode === 'all' || a.mode === filterMode;
      return matchesSearch && matchesMode;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortOrder === 'highest') return b.percentage - a.percentage;
      if (sortOrder === 'lowest') return a.percentage - b.percentage;
      return 0;
    });

  const formatTime = (s) => {
    if (!s) return '0m';
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-white py-12 px-6 font-sans">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-12">
          <h1 className="text-3xl font-black text-primary mb-2 tracking-tight">My Papers</h1>
          <p className="text-secondary font-medium italic">Your progress journey through A-Level exams.</p>
        </header>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-10 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search by paper name..."
              className="w-full bg-surface border border-border rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-accent focus:bg-white transition-all shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <select 
                className="bg-white border border-border rounded-xl py-2 pl-9 pr-4 text-xs font-bold uppercase text-secondary focus:outline-none focus:border-accent appearance-none cursor-pointer"
                value={filterMode}
                onChange={e => setFilterMode(e.target.value)}
              >
                <option value="all">All Modes</option>
                <option value="exam">Exam</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            
            <select 
              className="bg-white border border-border rounded-xl py-2 px-4 text-xs font-bold uppercase text-secondary focus:outline-none focus:border-accent appearance-none cursor-pointer"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="highest">Highest Score</option>
              <option value="lowest">Lowest Score</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-surface rounded-3xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-64 h-64 mx-auto mb-8 opacity-20 grayscale">
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="40" y="40" width="120" height="150" rx="8" stroke="currentColor" strokeWidth="4"/>
                <path d="M60 80H140" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                <path d="M60 110H110" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                <circle cx="150" cy="150" r="30" stroke="currentColor" strokeWidth="4" strokeDasharray="8 8"/>
                <path d="M140 140L160 160" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="text-2xl font-black text-primary mb-2">No papers yet.</h3>
            <p className="text-secondary font-medium mb-8">Upload your first paper and start your journey to perfection.</p>
            <Link to="/upload" className="bg-accent text-white px-8 py-3 rounded-xl font-bold shadow-soft hover:bg-accent-hover active:scale-95 transition-all">Upload Paper</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
              {filtered.map(a => (
                <motion.div 
                  key={a.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white border border-border rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-accent/30 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${a.mode === 'exam' ? 'bg-red-50 text-error' : 'bg-emerald-50 text-success'}`}>
                      {a.mode}
                    </div>
                    <button className="text-muted hover:text-primary transition-colors"><MoreVertical size={18}/></button>
                  </div>

                  <h3 className="font-bold text-primary mb-1 line-clamp-1 group-hover:text-accent transition-colors">{a.paper?.title}</h3>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center gap-1.5 text-xs text-secondary font-medium">
                      <Calendar size={12} /> {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 border-l border-border pl-3">
                      {a.annotations && Object.keys(a.annotations).length > 0 && (
                        <Pencil size={12} className="text-accent" title="Annotated PDF" />
                      )}
                      {a.roughPageData && (
                        <Layout size={12} className="text-accent" title="Rough Page notes" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-surface rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Score</div>
                      <div className="text-lg font-black text-primary">{a.percentage}%</div>
                    </div>
                    <div className="bg-surface rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Time</div>
                      <div className="text-lg font-black text-primary">{formatTime(a.totalTimeTaken)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link to={`/results/${a.id}`} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-center text-xs font-bold hover:bg-black transition-all shadow-sm active:scale-95">View Analysis</Link>
                    <Link to={`/solve/${a.paper?.id}`} className="w-10 h-10 flex items-center justify-center border border-border rounded-xl text-secondary hover:text-accent hover:border-accent transition-all active:scale-95"><RotateCcw size={16}/></Link>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

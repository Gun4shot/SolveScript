import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, CheckCircle2, XCircle, Clock, BarChart3, RefreshCcw, ArrowRight, AlertCircle, Bookmark } from 'lucide-react';
import { attemptsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

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

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-surface border-t-accent rounded-full animate-spin" />
    </div>
  );

  if (!attempt) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
      <AlertCircle size={48} className="text-error" />
      <p className="text-secondary font-medium">Results not found</p>
      <Link to="/dashboard" className="text-accent hover:underline">Back to Dashboard</Link>
    </div>
  );

  const formatTime = (s) => {
    if (!s || s === 0) return '0s';
    const mins = Math.floor(s / 60);
    const secs = Math.round(s % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Performance bar proportions
  const total = attempt.paper?.totalQuestions || 40;
  const correctWidth = (attempt.totalCorrect / total) * 100;
  const wrongWidth = (attempt.totalWrong / total) * 100;
  const skippedWidth = (attempt.totalSkipped / total) * 100;

  return (
    <div className="min-h-screen bg-white py-12 px-6 font-sans select-none">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation */}
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors text-sm font-semibold mb-8 group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-16">
          
          {/* Section 1: Score Summary */}
          <div className="md:col-span-5 flex flex-col items-center text-center">
            <div className="relative w-56 h-56 mb-8">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#F1F5F9" strokeWidth="6"/>
                <motion.circle 
                  cx="50" cy="50" r="46" fill="none" stroke="#4F46E5" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray="289"
                  initial={{ strokeDashoffset: 289 }}
                  animate={{ strokeDashoffset: 289 - (289 * attempt.percentage) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-primary tracking-tighter">{attempt.percentage}%</span>
                <span className="text-secondary font-bold text-sm uppercase tracking-widest">{attempt.totalCorrect} / {total} Correct</span>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              {[
                { label: 'Time', value: formatTime(attempt.totalTimeTaken), color: 'bg-surface text-primary border-border' },
                { label: 'Correct', value: attempt.totalCorrect, color: 'bg-emerald-50 text-success border-emerald-100' },
                { label: 'Wrong', value: attempt.totalWrong, color: 'bg-red-50 text-error border-red-100' },
              ].map((pill, i) => (
                <div key={i} className={`flex-1 py-2 rounded-xl border text-[10px] font-bold uppercase ${pill.color}`}>
                  <div className="opacity-60 mb-0.5">{pill.label}</div>
                  <div className="text-sm">{pill.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Performance Breakdown */}
          <div className="md:col-span-7 flex flex-col justify-center">
            <h1 className="text-3xl font-black text-primary mb-2 tracking-tight">{attempt.paper?.title}</h1>
            <p className="text-secondary font-medium mb-8">Solved on {new Date(attempt.createdAt).toLocaleDateString()} • {attempt.mode} Mode</p>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-secondary mb-3">
                  <span>Performance Breakdown</span>
                  <span className="text-primary">{attempt.totalCorrect} Correct / {attempt.totalWrong} Wrong</span>
                </div>
                <div className="h-6 w-full bg-surface rounded-full overflow-hidden flex border border-border">
                  <div className="bg-success h-full transition-all duration-1000" style={{ width: `${correctWidth}%` }} />
                  <div className="bg-error h-full transition-all duration-1000" style={{ width: `${wrongWidth}%` }} />
                  <div className="bg-muted h-full transition-all duration-1000" style={{ width: `${skippedWidth}%` }} />
                </div>
                <div className="flex gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-secondary uppercase"><div className="w-2 h-2 bg-success rounded-full"/> Correct</div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-secondary uppercase"><div className="w-2 h-2 bg-error rounded-full"/> Wrong</div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-secondary uppercase"><div className="w-2 h-2 bg-muted rounded-full"/> Unanswered</div>
                </div>
              </div>

              <div className="flex gap-4">
                <Link to={`/solve/${attempt.paper?.id}`} className="flex-1 bg-white border-2 border-border text-primary px-6 py-3 rounded-xl font-bold text-sm hover:bg-surface transition-all active:scale-95 text-center flex items-center justify-center gap-2">
                  <RefreshCcw size={16} /> Solve Again
                </Link>
                <Link to="/upload" className="flex-1 bg-accent text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-accent-hover transition-all shadow-sm active:scale-95 text-center flex items-center justify-center gap-2">
                  New Paper <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Question-by-Question Table */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-8 py-5 border-b border-border bg-surface flex justify-between items-center">
            <h2 className="text-sm font-black text-primary uppercase tracking-widest">Question-by-Question Analysis</h2>
            <div className="flex items-center gap-4 text-[10px] font-bold text-muted uppercase">
              <span className="flex items-center gap-1"><Clock size={12} className="text-amber-500" /> Slowest Response</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] border-b border-border">
                  <th className="px-8 py-4">#</th>
                  <th className="px-8 py-4 text-center">Your Answer</th>
                  <th className="px-8 py-4 text-center">Correct</th>
                  <th className="px-8 py-4">Time Taken</th>
                  <th className="px-8 py-4">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(attempt.answers || {}).filter(([k]) => !k.includes('_time')).map(([qNum, ansData]) => {
                  const isCorrect = ansData.isCorrect;
                  const isSkipped = !ansData.selected;
                  const timeTaken = attempt.answers[qNum + '_time'] || 0;
                  const isSlow = timeTaken > 120; // Example threshold

                  return (
                    <tr key={qNum} className={`${!isCorrect ? 'bg-red-50/30' : isSkipped ? 'bg-surface/50' : 'hover:bg-surface/30'} transition-colors`}>
                      <td className="px-8 py-4 text-sm font-black text-primary">{qNum}</td>
                      <td className="px-8 py-4">
                        <div className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center font-bold text-xs border ${isSkipped ? 'bg-white border-border text-muted' : isCorrect ? 'bg-emerald-50 border-success text-success' : 'bg-red-50 border-error text-error'}`}>
                          {ansData.selected || '—'}
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center text-sm font-bold text-primary">{ansData.correct}</td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-secondary">
                          <Clock size={14} className={isSlow ? "text-amber-500" : "text-muted"} />
                          {formatTime(timeTaken)}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        {isCorrect ? <CheckCircle2 className="text-success" size={20} /> : <XCircle className="text-error" size={20} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <button className="flex items-center gap-2 text-xs font-bold text-accent hover:text-accent-hover transition-colors uppercase tracking-widest">
            <Bookmark size={14} /> Review Annotated Paper
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ArrowLeft, Clock3, FilePenLine, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { writtenAttemptsAPI, writtenLibraryAPI } from '../../services/api';
import './WrittenSetupPage.css';

export default function WrittenSetupPage() {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [paper, setPaper] = useState(null);
  const [mode, setMode] = useState('exam');
  const [minutes, setMinutes] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    writtenLibraryAPI.getOne(paperId)
      .then((response) => {
        if (!active) return;
        setPaper(response.data.paper);
        setMinutes(String(response.data.paper.durationMinutes));
      })
      .catch(() => { if (active) toast.error('That written paper could not be opened.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [paperId, toast]);

  const start = async () => {
    const durationMinutes = Number(minutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 360) {
      toast.error('Choose a whole number of minutes between 1 and 360.');
      return;
    }
    setStarting(true);
    try {
      const response = await writtenAttemptsAPI.create({ paperId, mode, durationMinutes });
      navigate(`/written/attempt/${response.data.attempt.id}`, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not start this paper.');
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <div className="solver-loading"><div className="spinner spinner-lg" /><p>Opening paper setup…</p></div>;
  if (!paper) return <div className="solver-loading"><p>This written paper is unavailable.</p></div>;

  return (
    <main className="written-setup-page">
      <Link className="written-setup-back" to="/written-library"><ArrowLeft size={16} /> Subjective papers</Link>
      <section className="written-setup-card">
        <span className="written-kicker"><FilePenLine size={15} /> PAPER {paper.component}</span>
        <h1>{paper.title}</h1>
        <p>{paper.subject} · {paper.session} {paper.year} · {paper.totalMarks} marks</p>
        <div className="written-setup-facts"><span><Clock3 size={15} /> Official time: {paper.durationMinutes} minutes</span><span><ShieldCheck size={15} /> Your ink saves to your account</span></div>

        {!isAuthenticated ? (
          <div className="written-login-required"><b>Sign in to protect your written work.</b><p>Written-paper drafts are saved to your account, so you can safely resume on another device.</p><Link className="studio-primary" to="/login" state={{ from: location }}>Sign in to begin</Link></div>
        ) : (
          <>
            <fieldset className="written-mode-picker"><legend>Choose your session</legend>
              <label className={mode === 'exam' ? 'selected' : ''}><input type="radio" value="exam" checked={mode === 'exam'} onChange={() => { setMode('exam'); setMinutes(String(paper.durationMinutes)); }} /><span><b>Timed exam</b><small>Official countdown. Mark scheme stays closed until you finish.</small></span></label>
              <label className={mode === 'casual' ? 'selected' : ''}><input type="radio" value="casual" checked={mode === 'casual'} onChange={() => { setMode('casual'); setMinutes(String(paper.durationMinutes)); }} /><span><b>Casual practice</b><small>Work at your pace with a simple elapsed-time clock.</small></span></label>
              <label className={mode === 'custom' ? 'selected' : ''}><input type="radio" value="custom" checked={mode === 'custom'} onChange={() => setMode('custom')} /><span><b>Custom timer</b><small>Set a focused practice time for this paper.</small></span></label>
            </fieldset>
            {mode !== 'casual' && <label className="written-duration">Timer length <input min="1" max="360" type="number" value={minutes} onChange={(event) => setMinutes(event.target.value)} /> <span>minutes</span></label>}
            <button className="written-start-button" type="button" onClick={start} disabled={starting}>{starting ? 'Opening your desk…' : mode === 'exam' ? 'Start timed exam' : 'Start paper'}</button>
          </>
        )}
      </section>
    </main>
  );
}

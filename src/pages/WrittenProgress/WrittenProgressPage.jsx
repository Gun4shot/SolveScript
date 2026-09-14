import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Folder, Sigma, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { writtenAttemptsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './WrittenProgressPage.css';

const SESSION_LABELS = {
  March: 'February–March',
  'Feb/March': 'February–March',
  'May/June': 'May–June',
  'Oct/Nov': 'October–November',
  'October/November': 'October–November',
};
const SESSION_ORDER = ['March', 'Feb/March', 'May/June', 'Oct/Nov', 'October/November'];
const sessionLabel = (session) => SESSION_LABELS[session] || session;
const attemptDate = (value) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

function FolderCard({ title, detail, count, tone = 'subject', onOpen }) {
  return <button type="button" className={`collection-folder-card ${tone}`} onClick={onOpen}>
    <span className="collection-folder-tab">{tone === 'subject' ? 'STUDY FILES' : 'PAPER FILES'}</span>
    <div className="collection-folder-icon"><Folder size={tone === 'subject' ? 29 : 23} /></div>
    <b>{title}</b>
    <small>{detail}</small>
    <span className="collection-folder-open">Open {count ? <em>{count}</em> : null}<ArrowRight size={16} /></span>
  </button>;
}

function CollectionCard({ group, onSelectVersion, onDeleteVersion, busyId }) {
  const selectedCount = group.components.length;
  return <article className="collection-card">
    <header className="collection-card-head">
      <div>
        <p className="collection-card-kicker"><Folder size={13} /> {sessionLabel(group.session)} {group.year} · Variant {group.variant}</p>
        <h2>{group.isComplete ? 'Complete collection' : 'Collection in progress'}</h2>
        <p className="collection-card-meta">{selectedCount} of {group.totalComponents} components selected for the final grade · {group.history.length} saved version{group.history.length === 1 ? '' : 's'}</p>
      </div>
      <div className="collection-score"><strong>{group.totalMarks ? `${group.percentage}%` : '—'}</strong><span>{group.totalMarks ? `${group.totalAwarded} / ${group.totalMarks} marks` : 'Select marked versions'}</span></div>
    </header>
    <div className="collection-components">{group.expectedPaperNumbers.map((number) => {
      const component = group.components.find((item) => item.paperNumber === number);
      const hasSavedVersion = group.history.some((item) => String(item.paperNumber) === String(number));
      return <div key={number} className="collection-component"><b>Paper {number}</b><span>{component ? `${component.score}/${component.totalMarks} · ${component.grade}` : hasSavedVersion ? 'Saved — choose a marked version below' : 'Not completed'}</span></div>;
    })}</div>
    {group.history.length > 0 && <section className="collection-history"><header><div><span className="studio-label">SAVED VERSIONS</span><h3>Choose the version that counts.</h3></div><p>Every attempt stays here until you delete it.</p></header>{group.history.map((attempt, index) => <article className={`collection-version ${attempt.countsTowardProgress ? 'selected' : ''}`} key={`${attempt.source}-${attempt.id}`}><div><span>Version {group.history.length - index} · Paper {attempt.component}</span><strong>{attempt.isMarked ? `${attempt.score} / ${attempt.totalMarks} · ${attempt.grade}` : 'Awaiting your mark'}</strong><small>Saved {attemptDate(attempt.completedAt)}{attempt.countsTowardProgress ? ' · Selected for final grade' : ''}</small></div><div className="collection-version-actions"><Link to={attempt.source === 'written' ? `/written/results/${attempt.id}` : `/results/${attempt.id}`}><span>{attempt.source === 'written' ? 'Open review' : 'Open result'}</span><ExternalLink size={14} aria-hidden="true" /></Link>{attempt.source === 'written' && attempt.isMarked && <button type="button" className="collection-select-version" onClick={() => onSelectVersion(attempt)} disabled={attempt.countsTowardProgress || busyId === attempt.id}>{attempt.countsTowardProgress ? <><CheckCircle2 size={14} /> Counts toward grade</> : busyId === attempt.id ? 'Selecting…' : 'Use for final grade'}</button>}{attempt.source === 'written' && <button type="button" className="collection-delete-version" onClick={() => onDeleteVersion(attempt)} disabled={busyId === attempt.id} aria-label={`Delete Paper ${attempt.component} version ${group.history.length - index}`} title="Delete this saved version"><Trash2 size={15} /></button>}</div></article>)}</section>}
  </article>;
}

export default function WrittenProgressPage() {
  const toast = useToast();
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState({ subject: null, year: null, session: null });
  const [busyId, setBusyId] = useState('');

  const loadProgress = useCallback(async () => {
    try {
      setError('');
      const response = await writtenAttemptsAPI.getProgress();
      setProgress(response.data.progress || []);
    } catch {
      setError('Your paper collections could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProgress(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProgress]);

  const selectVersion = async (attempt) => {
    setBusyId(attempt.id);
    try {
      await writtenAttemptsAPI.update(attempt.id, { countsTowardProgress: true });
      await loadProgress();
      toast.success('This version now counts toward your final collection grade.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not select this version.');
    } finally {
      setBusyId('');
    }
  };

  const deleteVersion = async (attempt) => {
    if (!window.confirm('Delete this saved subjective-paper version? Its annotations and review cannot be restored.')) return;
    setBusyId(attempt.id);
    try {
      await writtenAttemptsAPI.delete(attempt.id);
      await loadProgress();
      toast.success('Saved paper version deleted.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete this saved version.');
    } finally {
      setBusyId('');
    }
  };

  const scoped = useMemo(() => progress.filter((group) => (!location.subject || group.subject === location.subject) && (!location.year || String(group.year) === String(location.year)) && (!location.session || group.session === location.session)), [progress, location]);
  const subjects = useMemo(() => [...new Map(progress.filter((group) => group.subject).map((group) => [group.subject, progress.filter((item) => item.subject === group.subject)])).entries()].sort(([left], [right]) => left.localeCompare(right)), [progress]);
  const years = useMemo(() => [...new Map(scoped.map((group) => [group.year, scoped.filter((item) => item.year === group.year)])).entries()].sort(([left], [right]) => Number(right) - Number(left)), [scoped]);
  const sessions = useMemo(() => [...new Map(scoped.map((group) => [group.session, scoped.filter((item) => item.session === group.session)])).entries()].sort(([left], [right]) => (SESSION_ORDER.indexOf(left) === -1 ? SESSION_ORDER.length : SESSION_ORDER.indexOf(left)) - (SESSION_ORDER.indexOf(right) === -1 ? SESSION_ORDER.length : SESSION_ORDER.indexOf(right)) || left.localeCompare(right)), [scoped]);
  const depth = location.session ? 'papers' : location.year ? 'sessions' : location.subject ? 'years' : 'subjects';
  const goBack = () => setLocation((current) => current.session ? { ...current, session: null } : current.year ? { ...current, year: null } : { subject: null, year: null, session: null });

  const breadcrumb = [location.subject, location.year, location.session].filter(Boolean);
  const title = depth === 'subjects' ? 'Your papers, in one place.' : depth === 'years' ? `${location.subject} papers` : depth === 'sessions' ? `${location.subject} · ${location.year}` : `${location.subject} · ${location.year} · ${sessionLabel(location.session)}`;
  const subtitle = depth === 'subjects' ? 'Open a subject folder, then a year and exam session to find every completed paper.' : depth === 'years' ? 'Choose a year folder.' : depth === 'sessions' ? 'Choose an exam session folder.' : 'Every completed MCQ and subjective paper for this session is here.';

  return <main className="written-progress-page">
    <header className="collections-hero"><span className="studio-label">PAPER COLLECTIONS</span>{depth !== 'subjects' && <button type="button" className="collection-back" onClick={goBack}><ArrowLeft size={15} /> Back</button>}<div className="collection-breadcrumb"><button type="button" onClick={() => setLocation({ subject: null, year: null, session: null })}>Collections</button>{breadcrumb.map((crumb) => <span key={crumb}>/ {typeof crumb === 'string' ? sessionLabel(crumb) : crumb}</span>)}</div><h1>{title}</h1><p>{subtitle}</p></header>
    {loading && <div className="solver-loading"><div className="spinner spinner-lg" /><p>Collecting your paper results…</p></div>}
    {error && <p className="studio-notice" role="alert">{error}</p>}
    {!loading && !error && progress.length === 0 && <section className="written-progress-empty"><Sigma size={30} /><div><h2>No completed papers yet.</h2><p>Finish a paper to begin building your collection.</p><Link to="/library">Browse MCQ papers <ArrowRight size={15} /></Link></div></section>}
    {!loading && !error && progress.length > 0 && <section className={`collection-folder-grid ${depth}`} aria-label="Paper collection folders">
      {depth === 'subjects' && subjects.map(([subject, groups]) => <FolderCard key={subject} title={subject} detail={`${groups.length} completed collection${groups.length === 1 ? '' : 's'}`} count={groups.length} onOpen={() => setLocation({ subject, year: null, session: null })} />)}
      {depth === 'years' && years.map(([year, groups]) => <FolderCard key={year} tone="year" title={year} detail={`${groups.length} completed collection${groups.length === 1 ? '' : 's'}`} count={groups.length} onOpen={() => setLocation((current) => ({ ...current, year, session: null }))} />)}
      {depth === 'sessions' && sessions.map(([session, groups]) => <FolderCard key={session} tone="session" title={sessionLabel(session)} detail={`${groups.length} completed collection${groups.length === 1 ? '' : 's'}`} count={groups.length} onOpen={() => setLocation((current) => ({ ...current, session }))} />)}
      {depth === 'papers' && scoped.map((group) => <CollectionCard key={group.id} group={group} onSelectVersion={selectVersion} onDeleteVersion={deleteVersion} busyId={busyId} />)}
    </section>}
  </main>;
}

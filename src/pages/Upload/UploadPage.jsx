import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { papersAPI } from '../../services/api';
import StudioDialog from '../../components/studio/StudioDialog';
import './UploadPage.css';

const SUBJECTS = [
  'Physics', 'Chemistry', 'Biology', 'Mathematics', 
  'Economics', 'Business', 'Accounting', 'Computer Science',
  'Psychology', 'Sociology', 'English Language', 'Other'
];

const SESSIONS = ['Feb/March', 'May/June', 'Oct/Nov'];
const YEARS = Array.from({ length: 20 }, (_, i) => String(2025 - i));
const VARIANTS = ['1', '2', '3'];

export default function UploadPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [questionPaper, setQuestionPaper] = useState(null);
  const [markingScheme, setMarkingScheme] = useState(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [session, setSession] = useState('');
  const [year, setYear] = useState('');
  const [variant, setVariant] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showCorrection, setShowCorrection] = useState(false);

  const [step, setStep] = useState(1); // 1: upload, 2: ready

  const onDropQuestion = useCallback((files) => {
    if (files[0]) setQuestionPaper(files[0]);
  }, []);

  const onDropMarking = useCallback((files) => {
    if (files[0]) setMarkingScheme(files[0]);
  }, []);

  const qpDropzone = useDropzone({
    onDrop: onDropQuestion,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false
  });

  const msDropzone = useDropzone({
    onDrop: onDropMarking,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false
  });

  const generateTitle = () => {
    const parts = [subject, level, session, year, variant ? `V${variant}` : ''].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : '';
  };

  const handleUpload = async () => {
    if (!questionPaper || (isAuthenticated && !markingScheme)) {
      toast.error(isAuthenticated ? 'Please upload both PDFs' : 'Please upload a question paper PDF');
      return;
    }

    if (!isAuthenticated) {
      // Guest papers remain in this browser session and cannot be auto-marked.
      const autoTitle = title || generateTitle() || 'Guest Paper';
      const qpUrl = URL.createObjectURL(questionPaper);
      
      const guestPaper = {
        id: 'guest-' + Date.now(),
        title: autoTitle,
        questionPaperBlob: qpUrl,
        isGuest: true,
        ungraded: true,
      };
      
      sessionStorage.setItem('currentPaperId', guestPaper.id);
      sessionStorage.setItem('currentPaperTitle', guestPaper.title);
      sessionStorage.setItem('guestPaperData', JSON.stringify(guestPaper));
      
      toast.info('Guest practice is ungraded and works in this browser session only. Sign in to upload a marking scheme and save work.');
      setStep(2);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('questionPaper', questionPaper);
      formData.append('markingScheme', markingScheme);
      formData.append('title', title || generateTitle() || 'Untitled Paper');
      formData.append('subject', subject);
      formData.append('level', level);
      formData.append('session', session);
      formData.append('year', year);
      formData.append('variant', variant);

      const res = await papersAPI.upload(formData);
      setParseResult(res.data.parsing);
      setAnswers(res.data.paper.answers);

      if (res.data.parsing.confidence === 'high') {
        toast.success(`Marking scheme parsed! ${res.data.parsing.totalFound}/40 answers found.`);
        setStep(2);
      } else {
        toast.warning(`Only ${res.data.parsing.totalFound}/40 answers found. Please verify.`);
        setShowCorrection(true);
      }

      // Store paper ID for solver
      sessionStorage.setItem('currentPaperId', res.data.paper.id);
      sessionStorage.setItem('currentPaperTitle', res.data.paper.title);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAnswerChange = (q, val) => {
    setAnswers(prev => ({ ...prev, [q]: val.toUpperCase() }));
  };

  const handleSaveCorrections = async () => {
    const paperId = sessionStorage.getItem('currentPaperId');
    if (!paperId) return;

    try {
      await papersAPI.updateAnswers(paperId, answers);
      toast.success('Answers saved!');
      setShowCorrection(false);
      setStep(2);
    } catch {
      toast.error('Failed to save corrections');
    }
  };

  const handleStartSolving = () => {
    const paperId = sessionStorage.getItem('currentPaperId');
    if (!paperId) {
      toast.error('Paper is not ready yet');
      return;
    }
    sessionStorage.removeItem('solverConfig');
    navigate(`/solve/${paperId}`);
  };

  // Step 1: Upload
  if (step === 1) {
    return (
      <div className="upload-page">
        <div className="container">
          <div className="upload-header animate-fade-in-up">
            <h1>Upload Paper</h1>
            <p className="text-secondary">{isAuthenticated ? 'Upload your question paper and marking scheme to get automatic feedback.' : 'Upload a question paper to practise in this browser. Sign in to add a marking scheme and save your work.'}</p>
          </div>

          <div className="upload-grid">
            {/* Dropzones */}
            <div className="upload-section animate-fade-in-up stagger-1">
              <h3>Question Paper</h3>
              <div
                {...qpDropzone.getRootProps({ 'aria-label': 'Upload question paper PDF' })}
                className={`dropzone ${qpDropzone.isDragActive ? 'dropzone-active' : ''} ${questionPaper ? 'dropzone-done' : ''}`}
              >
                <input {...qpDropzone.getInputProps({ 'aria-label': 'Choose question paper PDF' })} />
                {questionPaper ? (
                  <div className="dropzone-file">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>{questionPaper.name}</span>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setQuestionPaper(null); }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="dropzone-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p>Drop PDF here or <span className="text-accent">browse</span></p>
                    <p className="dropzone-hint">Question paper PDF (max 50MB)</p>
                  </div>
                )}
              </div>
            </div>

            {isAuthenticated ? <div className="upload-section animate-fade-in-up stagger-2">
              <h3>Marking Scheme</h3>
              <div
                {...msDropzone.getRootProps({ 'aria-label': 'Upload marking scheme PDF' })}
                className={`dropzone ${msDropzone.isDragActive ? 'dropzone-active' : ''} ${markingScheme ? 'dropzone-done' : ''}`}
              >
                <input {...msDropzone.getInputProps({ 'aria-label': 'Choose marking scheme PDF' })} />
                {markingScheme ? (
                  <div className="dropzone-file">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>{markingScheme.name}</span>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setMarkingScheme(null); }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="dropzone-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p>Drop PDF here or <span className="text-accent">browse</span></p>
                    <p className="dropzone-hint">Mark scheme PDF (max 50MB)</p>
                  </div>
                )}
              </div>
            </div> : <section className="upload-section upload-signin-note animate-fade-in-up stagger-2" aria-label="Automatic marking requires an account">
              <h3>Automatic marking</h3>
              <p>Sign in to upload a marking scheme, check every answer, and keep this paper after this browser session.</p>
              <Link className="btn btn-secondary btn-sm" to="/login">Sign in for automatic marking</Link>
            </section>}
          </div>

          {/* Metadata */}
          <div className="metadata-section card animate-fade-in-up stagger-3">
            <h3 style={{ marginBottom: 'var(--space-5)' }}>Paper Details</h3>
            <div className="metadata-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="paper-subject">Subject</label>
                <select id="paper-subject" className="select" value={subject} onChange={e => setSubject(e.target.value)}>
                  <option value="">Select subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="input-group">
                <fieldset className="input-fieldset"><legend className="input-label">Level</legend><div className="checkbox-group">
                  {['AS', 'A2'].map(l => (
                    <label key={l} className={`checkbox-card ${level === l ? 'active' : ''}`}>
                      <input type="radio" name="level" value={l} checked={level === l} onChange={e => setLevel(e.target.value)} />
                      <span>{l}</span>
                    </label>
                  ))}
                </div></fieldset>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="paper-session">Session</label>
                <select id="paper-session" className="select" value={session} onChange={e => setSession(e.target.value)}>
                  <option value="">Select session</option>
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="paper-year">Year</label>
                <select id="paper-year" className="select" value={year} onChange={e => setYear(e.target.value)}>
                  <option value="">Select year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="input-group">
                <fieldset className="input-fieldset"><legend className="input-label">Variant</legend><div className="checkbox-group">
                  {VARIANTS.map(v => (
                    <label key={v} className={`checkbox-card ${variant === v ? 'active' : ''}`}>
                      <input type="radio" name="variant" value={v} checked={variant === v} onChange={e => setVariant(e.target.value)} />
                      <span>V{v}</span>
                    </label>
                  ))}
                </div></fieldset>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="paper-title">Custom Title (optional)</label>
                <input
                  id="paper-title"
                  className="input"
                  placeholder={generateTitle() || 'e.g. Physics P1 May 2024'}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="upload-actions animate-fade-in-up">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleUpload}
              disabled={uploading || !questionPaper || (isAuthenticated && !markingScheme)}
            >
              {uploading ? (
                <>
                  <span className="spinner" />
                  {isAuthenticated ? 'Parsing marking scheme...' : 'Preparing paper...'}
                </>
              ) : (
                <>
                  {isAuthenticated ? 'Upload & Parse' : 'Open guest practice'}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </div>

          {showCorrection && (
            <StudioDialog title="Verify answers" onClose={() => setShowCorrection(false)} className="answer-correction-dialog">
                <div className="modal-header">
                  <h3>Verify Answers</h3>
                </div>
                <div className="modal-body">
                  <p className="text-secondary" style={{ marginBottom: 'var(--space-5)' }}>
                    {parseResult?.totalFound}/40 answers were auto-detected. Please verify and fill in any missing answers.
                  </p>
                  <div className="answer-correction-grid">
                    {Array.from({ length: 40 }, (_, i) => i + 1).map(q => (
                      <div key={q} className="answer-correction-item">
                        <span className="q-number">{q}</span>
                        <div className="answer-options">
                          {['A', 'B', 'C', 'D'].map(opt => (
                            <button
                              key={opt}
                              className={`answer-opt ${answers[q] === opt ? 'selected' : ''}`}
                              onClick={() => handleAnswerChange(q, opt)}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowCorrection(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveCorrections}>
                    Save & Continue
                  </button>
                </div>
            </StudioDialog>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Ready
  return (
    <div className="upload-page">
      <div className="container">
        <div className="upload-header mode-header animate-fade-in-up">
          <span className="mode-eyebrow">SolveScript session</span>
          <h1>Your paper is ready.</h1>
          <p className="text-secondary">Open it in the solver to choose casual practice or a timed session with custom duration.</p>
        </div>

        <div className="paper-ready-card animate-fade-in-up">
          <CheckCircle2 size={32} aria-hidden="true" />
          <div>
            <h2>{sessionStorage.getItem('currentPaperTitle') || title || generateTitle() || 'Uploaded paper'}</h2>
            <p>{isAuthenticated ? 'The full paper view, annotations, answer sheet, and report card are ready.' : 'The full paper view and annotations are ready. Guest practice is not automatically marked or saved after this browser session.'}</p>
          </div>
        </div>

        <div className="upload-actions animate-fade-in-up">
          <button className="btn btn-secondary btn-lg" onClick={() => setStep(1)}>
            <ArrowLeft size={17} aria-hidden="true" /> Back
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleStartSolving}>
            Open solver <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { papersAPI } from '../../services/api';
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

  // Mode selection state
  const [mode, setMode] = useState('');
  const [customTime, setCustomTime] = useState(60);
  const [showInstantFeedback, setShowInstantFeedback] = useState(true);
  const [step, setStep] = useState(1); // 1: upload, 2: mode select

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
    if (!questionPaper || !markingScheme) {
      toast.error('Please upload both PDFs');
      return;
    }

    if (!isAuthenticated) {
      // Guest mode: store files in memory and go straight to solver
      const autoTitle = title || generateTitle() || 'Guest Paper';
      const qpUrl = URL.createObjectURL(questionPaper);
      
      // For guest mode, we need to parse the marking scheme client-side
      // Store in sessionStorage for the solver page
      const guestPaper = {
        id: 'guest-' + Date.now(),
        title: autoTitle,
        questionPaperBlob: qpUrl,
        isGuest: true
      };
      
      sessionStorage.setItem('currentPaperId', guestPaper.id);
      sessionStorage.setItem('guestPaperData', JSON.stringify(guestPaper));
      
      toast.info('Guest mode: Paper saving is disabled. Sign up to save your progress!');
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
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
    } catch (err) {
      toast.error('Failed to save corrections');
    }
  };

  const handleStartSolving = () => {
    if (!mode) {
      toast.error('Please select a mode');
      return;
    }

    const paperId = sessionStorage.getItem('currentPaperId');
    const config = {
      mode,
      customTime: mode === 'exam' ? customTime : 0,
      showInstantFeedback: mode === 'casual' ? showInstantFeedback : false
    };
    sessionStorage.setItem('solverConfig', JSON.stringify(config));
    navigate(`/solve/${paperId}`);
  };

  // Step 1: Upload
  if (step === 1) {
    return (
      <div className="upload-page">
        <div className="container">
          <div className="upload-header animate-fade-in-up">
            <h1>Upload Paper</h1>
            <p className="text-secondary">Upload your question paper and marking scheme to get started</p>
          </div>

          <div className="upload-grid">
            {/* Dropzones */}
            <div className="upload-section animate-fade-in-up stagger-1">
              <h3>Question Paper</h3>
              <div
                {...qpDropzone.getRootProps()}
                className={`dropzone ${qpDropzone.isDragActive ? 'dropzone-active' : ''} ${questionPaper ? 'dropzone-done' : ''}`}
              >
                <input {...qpDropzone.getInputProps()} />
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

            <div className="upload-section animate-fade-in-up stagger-2">
              <h3>Marking Scheme</h3>
              <div
                {...msDropzone.getRootProps()}
                className={`dropzone ${msDropzone.isDragActive ? 'dropzone-active' : ''} ${markingScheme ? 'dropzone-done' : ''}`}
              >
                <input {...msDropzone.getInputProps()} />
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
            </div>
          </div>

          {/* Metadata */}
          <div className="metadata-section card animate-fade-in-up stagger-3">
            <h3 style={{ marginBottom: 'var(--space-5)' }}>Paper Details</h3>
            <div className="metadata-grid">
              <div className="input-group">
                <label className="input-label">Subject</label>
                <select className="select" value={subject} onChange={e => setSubject(e.target.value)}>
                  <option value="">Select subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Level</label>
                <div className="checkbox-group">
                  {['AS', 'A2'].map(l => (
                    <label key={l} className={`checkbox-card ${level === l ? 'active' : ''}`}>
                      <input type="radio" name="level" value={l} checked={level === l} onChange={e => setLevel(e.target.value)} />
                      <span>{l}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Session</label>
                <select className="select" value={session} onChange={e => setSession(e.target.value)}>
                  <option value="">Select session</option>
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Year</label>
                <select className="select" value={year} onChange={e => setYear(e.target.value)}>
                  <option value="">Select year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Variant</label>
                <div className="checkbox-group">
                  {VARIANTS.map(v => (
                    <label key={v} className={`checkbox-card ${variant === v ? 'active' : ''}`}>
                      <input type="radio" name="variant" value={v} checked={variant === v} onChange={e => setVariant(e.target.value)} />
                      <span>V{v}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Custom Title (optional)</label>
                <input
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
              disabled={uploading || !questionPaper || !markingScheme}
            >
              {uploading ? (
                <>
                  <span className="spinner" />
                  Parsing marking scheme...
                </>
              ) : (
                <>
                  Upload & Parse
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Answer Correction Modal */}
          {showCorrection && (
            <div className="modal-overlay" onClick={() => setShowCorrection(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                <div className="modal-header">
                  <h3>Verify Answers</h3>
                  <button className="btn btn-ghost btn-icon" onClick={() => setShowCorrection(false)}>✕</button>
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
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Mode Selection
  return (
    <div className="upload-page">
      <div className="container">
        <div className="upload-header animate-fade-in-up">
          <h1>Choose Your Mode</h1>
          <p className="text-secondary">How would you like to solve this paper?</p>
        </div>

        <div className="mode-grid animate-fade-in-up">
          <div
            className={`mode-card glass-card ${mode === 'exam' ? 'mode-active' : ''}`}
            onClick={() => setMode('exam')}
          >
            <div className="mode-icon exam-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h2>Exam Mode</h2>
            <p className="text-secondary">Simulated exam conditions. Timer, no peeking at answers until you submit.</p>
            
            {mode === 'exam' && (
              <div className="mode-options animate-fade-in-up">
                <div className="input-group">
                  <label className="input-label">Time Limit (minutes)</label>
                  <div className="time-options">
                    {[45, 60, 75, 90].map(t => (
                      <button
                        key={t}
                        className={`btn btn-sm ${customTime === t ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={(e) => { e.stopPropagation(); setCustomTime(t); }}
                      >
                        {t} min
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    className="input"
                    value={customTime}
                    onChange={e => setCustomTime(Math.max(1, parseInt(e.target.value) || 60))}
                    onClick={e => e.stopPropagation()}
                    min="1"
                    max="300"
                    style={{ marginTop: 'var(--space-2)' }}
                    placeholder="Custom time"
                  />
                </div>
              </div>
            )}
          </div>

          <div
            className={`mode-card glass-card ${mode === 'casual' ? 'mode-active' : ''}`}
            onClick={() => setMode('casual')}
          >
            <div className="mode-icon casual-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <h2>Casual Mode</h2>
            <p className="text-secondary">No timer. Solve at your own pace. Toggle instant answer feedback.</p>
            
            {mode === 'casual' && (
              <div className="mode-options animate-fade-in-up">
                <label className="toggle-row" onClick={e => e.stopPropagation()}>
                  <span>Show answers after each question</span>
                  <button
                    className={`toggle ${showInstantFeedback ? 'toggle-on' : ''}`}
                    onClick={() => setShowInstantFeedback(!showInstantFeedback)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="upload-actions animate-fade-in-up">
          <button className="btn btn-secondary btn-lg" onClick={() => setStep(1)}>
            ← Back
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleStartSolving} disabled={!mode}>
            Start Solving
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

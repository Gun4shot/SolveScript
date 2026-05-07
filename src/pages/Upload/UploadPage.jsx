import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, UploadCloud, CheckCircle2, AlertCircle, Settings, Play, Clock, Layout, ArrowRight } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { papersAPI } from '../../services/api';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Economics', 'Business', 'Accounting', 'Computer Science'];
const SESSIONS = ['Feb/March', 'May/June', 'Oct/Nov'];
const YEARS = Array.from({ length: 10 }, (_, i) => String(2025 - i));

export default function UploadPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // ALL hooks must be declared before any conditional returns
  const [step, setStep] = useState(1);
  const [questionPaper, setQuestionPaper] = useState(null);
  const [markingScheme, setMarkingScheme] = useState(null);
  const [subject, setSubject] = useState('');
  const [session, setSession] = useState('');
  const [year, setYear] = useState('');
  const [uploading, setUploading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [showCorrection, setShowCorrection] = useState(false);
  const [mode, setMode] = useState('');
  const [customTime, setCustomTime] = useState(60);
  const [showInstantFeedback, setShowInstantFeedback] = useState(true);
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [confidence, setConfidence] = useState('NONE');
  const [paper, setPaper] = useState(null);

  const onDropQuestion = useCallback((files) => { if (files[0]) setQuestionPaper(files[0]); }, []);
  const onDropMarking = useCallback((files) => { if (files[0]) setMarkingScheme(files[0]); }, []);

  const qpDropzone = useDropzone({ onDrop: onDropQuestion, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 });
  const msDropzone = useDropzone({ onDrop: onDropMarking, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 });

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast.error('Please sign in to upload papers');
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate, toast]);

  // Conditional returns AFTER all hooks
  if (authLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return null;

  const extractText = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      const pagesToScan = Math.min(pdf.numPages, 3);
      for (let i = 1; i <= pagesToScan; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n${pageText}`;
      }
      return fullText;
    } catch (err) {
      console.error('Extraction Error:', err);
      return '';
    }
  };

  const parseAnswers = (text) => {
    const extracted = {};
    // Handle format: "N A M" where N=question number, A=answer, M=marks
    // Also handles "N A" without marks column
    const regex = /(?:^|\n)\s*(\d{1,2})\s+([A-D])(?:\s+\d+)?(?:\s*$|\s*\n)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const qNum = parseInt(match[1]);
      const ans = match[2].toUpperCase();
      if (qNum >= 1 && qNum <= 40 && !extracted[qNum]) {
        extracted[qNum] = ans;
      }
    }
    return extracted;
  };

  const handleProcessFiles = async () => {
    if (!questionPaper || !markingScheme) return toast.error('Please upload both PDFs');
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('questionPaper', questionPaper);
      formData.append('markingScheme', markingScheme);
      formData.append('title', `${subject} ${year} ${session}`.trim() || 'Untitled Paper');
      formData.append('subject', subject);
      formData.append('session', session);
      formData.append('year', year);

      const res = await papersAPI.upload(formData);
      const paperData = res.data.paper;
      
      setPaper(paperData);
      setAnswers(paperData.answers || {});
      setExtractedQuestions(paperData.extractedQuestions || []);
      setConfidence(paperData.extractionConfidence || 'NONE');
      sessionStorage.setItem('currentPaperId', paperData.id);

      toast.success('Answers extracted successfully!');
      setStep(3);
    } catch (err) {
      const msg = err.response?.data?.message || 'Upload and processing failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmVerification = async () => {
    setUploading(true);
    try {
      const paperId = sessionStorage.getItem('currentPaperId');
      // FIX: Don't double-wrap answers. papersAPI.updateAnswers already wraps in { answers }
      await papersAPI.updateAnswers(paperId, answers);
      setStep(3);
    } catch (err) {
      toast.error('Failed to save corrections');
    } finally {
      setUploading(false);
    }
  };

  const handleStartSolving = () => {
    if (!mode) return toast.error('Please select a mode');
    const paperId = sessionStorage.getItem('currentPaperId');
    sessionStorage.setItem('solverConfig', JSON.stringify({
      mode, customTime: mode === 'exam' ? customTime : 0, showInstantFeedback: mode === 'casual' ? showInstantFeedback : false
    }));
    navigate(`/solve/${paperId}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface py-12 px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border -z-10" />
          {[
            { num: 1, label: 'Upload', icon: UploadCloud },
            { num: 2, label: 'Verify', icon: Settings },
            { num: 3, label: 'Solve', icon: Play }
          ].map((s) => (
            <div key={s.num} className="flex flex-col items-center gap-2 bg-surface px-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold border-4 transition-colors ${step >= s.num ? 'bg-accent border-indigo-100 text-white' : 'bg-white border-border text-secondary'}`}>
                {step > s.num ? <CheckCircle2 size={20} /> : s.num}
              </div>
              <span className={`text-sm font-medium ${step >= s.num ? 'text-primary' : 'text-secondary'}`}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-border p-8 md:p-10">
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-bold mb-6 text-primary">Upload Past Paper</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div {...qpDropzone.getRootProps()} className={`p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${qpDropzone.isDragActive ? 'border-accent bg-indigo-50' : questionPaper ? 'border-success bg-emerald-50' : 'border-border hover:border-accent hover:bg-surface'}`}>
                    <input {...qpDropzone.getInputProps()} />
                    {questionPaper ? (
                      <div className="text-success flex flex-col items-center">
                        <FileText size={32} className="mb-2" />
                        <span className="font-medium truncate w-full px-4">{questionPaper.name}</span>
                      </div>
                    ) : (
                      <div className="text-secondary flex flex-col items-center">
                        <UploadCloud size={32} className="mb-2" />
                        <p className="font-medium">Question Paper</p>
                      </div>
                    )}
                  </div>

                  <div {...msDropzone.getRootProps()} className={`p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${msDropzone.isDragActive ? 'border-accent bg-indigo-50' : markingScheme ? 'border-success bg-emerald-50' : 'border-border hover:border-accent hover:bg-surface'}`}>
                    <input {...msDropzone.getInputProps()} />
                    {markingScheme ? (
                      <div className="text-success flex flex-col items-center">
                        <FileText size={32} className="mb-2" />
                        <span className="font-medium truncate w-full px-4">{markingScheme.name}</span>
                      </div>
                    ) : (
                      <div className="text-secondary flex flex-col items-center">
                        <UploadCloud size={32} className="mb-2" />
                        <p className="font-medium">Marking Scheme</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <select className="bg-surface border border-border rounded-lg px-4 py-3 text-primary focus:outline-none focus:border-accent" value={subject} onChange={e => setSubject(e.target.value)}>
                    <option value="">Subject</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className="bg-surface border border-border rounded-lg px-4 py-3 text-primary focus:outline-none focus:border-accent" value={year} onChange={e => setYear(e.target.value)}>
                    <option value="">Year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="bg-surface border border-border rounded-lg px-4 py-3 text-primary focus:outline-none focus:border-accent" value={session} onChange={e => setSession(e.target.value)}>
                    <option value="">Session</option>
                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleProcessFiles} disabled={!questionPaper || !markingScheme} className="bg-accent hover:bg-accentHover text-white px-8 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    Continue <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-primary">Review Answers</h2>
                  <p className="text-secondary text-sm mt-1">Verify the extracted answers below. Fix any missing or incorrect values.</p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border mb-6">
                  <button className="px-4 py-2 border-b-2 border-accent text-accent font-medium text-sm">Marking Scheme</button>
                  <button className="px-4 py-2 text-secondary hover:text-primary font-medium text-sm transition-colors opacity-50 cursor-not-allowed">Questions Preview (Read-only)</button>
                </div>

                <div className="bg-surface rounded-xl p-6 mb-8 max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: paper?.totalQuestions || 40 }, (_, i) => i + 1).map(qNum => {
                      const ans = answers[qNum];
                      return (
                        <div key={qNum} className={`flex items-center justify-between p-3 rounded-lg border bg-white ${!ans ? 'border-amber-300 ring-1 ring-amber-100' : 'border-border'}`}>
                          <span className="text-xs font-bold text-secondary">Q{qNum}</span>
                          <select 
                            value={ans || ''} 
                            onChange={(e) => setAnswers(prev => ({ ...prev, [qNum]: e.target.value }))}
                            className="bg-transparent text-sm font-bold text-primary focus:outline-none cursor-pointer"
                          >
                            <option value="">?</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>



                <div className="flex justify-end gap-4">
                  <button onClick={() => setStep(1)} className="px-6 py-3 text-secondary hover:text-primary font-medium transition-colors">
                    Back
                  </button>
                  <button onClick={handleConfirmVerification} disabled={uploading} className="bg-accent hover:bg-accent-hover text-white px-8 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2">
                    {uploading ? 'Saving...' : 'Confirm & Proceed'} <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="text-2xl font-bold mb-6 text-primary">Configure Session</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  <div onClick={() => setMode('exam')} className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${mode === 'exam' ? 'border-accent bg-indigo-50/50' : 'border-border hover:border-accent hover:bg-surface'}`}>
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-accent mb-4 shadow-sm border border-border">
                      <Clock size={24} />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Exam Mode</h3>
                    <p className="text-secondary text-sm mb-6">Strict timer, results hidden until submission.</p>
                    {mode === 'exam' && (
                      <div onClick={e => e.stopPropagation()} className="animate-fade-in">
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Time Limit (mins)</label>
                        <input type="number" min="1" max="300" className="w-full bg-white border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-accent font-medium" value={customTime} onChange={e => setCustomTime(Number(e.target.value))} />
                      </div>
                    )}
                  </div>

                  <div onClick={() => setMode('casual')} className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${mode === 'casual' ? 'border-accent bg-indigo-50/50' : 'border-border hover:border-accent hover:bg-surface'}`}>
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-accent mb-4 shadow-sm border border-border">
                      <Layout size={24} />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Casual Mode</h3>
                    <p className="text-secondary text-sm mb-6">Solve at your own pace with instant feedback.</p>
                    {mode === 'casual' && (
                      <div onClick={e => e.stopPropagation()} className="flex items-center justify-between bg-white p-3 rounded-lg border border-border animate-fade-in">
                        <span className="text-sm font-medium">Instant Feedback</span>
                        <button onClick={() => setShowInstantFeedback(!showInstantFeedback)} className={`w-12 h-6 rounded-full transition-colors relative ${showInstantFeedback ? 'bg-accent' : 'bg-gray-300'}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${showInstantFeedback ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button onClick={() => setStep(1)} className="text-secondary hover:text-primary font-medium transition-colors">
                    Start Over
                  </button>
                  <button onClick={handleStartSolving} disabled={!mode} className="bg-accent hover:bg-accentHover text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:grayscale">
                    Start Solving <Play size={18} fill="currentColor" />
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

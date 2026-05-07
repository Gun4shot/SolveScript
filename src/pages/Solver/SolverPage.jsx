import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Flag, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Grid, Pencil, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { papersAPI, attemptsAPI } from '../../services/api';
import RoughPage from '../../components/RoughPage';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function SolverPage() {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [paper, setPaper] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalQuestions, setTotalQuestions] = useState(40);

  const storageKey = `solver_layout_${user?._id || 'guest'}`;
  const [pdfPanelSize, setPdfPanelSize] = useState(() => Number(localStorage.getItem(storageKey)) || 70);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const pdfContainerRef = useRef(null);

  // Annotation state
  const [showAnnotationBar, setShowAnnotationBar] = useState(false);
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const fabricInitialized = useRef(false);
  const [activeTool, setActiveTool] = useState('draw');
  const [brushColor, setBrushColor] = useState('#4F46E5');
  const [brushSize, setBrushSize] = useState(3);
  const annotationsMapRef = useRef({});

  // Question state
  const [currentQuestionNum, setCurrentQuestionNum] = useState(1);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [correctAnswers, setCorrectAnswers] = useState({});
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [showGrid, setShowGrid] = useState(false);

  const [config, setConfig] = useState({ mode: 'casual', customTime: 60, showInstantFeedback: true });
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedDisplay, setElapsedDisplay] = useState(0);

  const [showRoughPage, setShowRoughPage] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Memoize file prop to prevent react-pdf re-renders
  const pdfFile = useMemo(() => {
    if (!pdfUrl) return null;
    return { url: pdfUrl, withCredentials: true };
  }, [pdfUrl]);

  // Load paper data
  useEffect(() => {
    const loadPaper = async () => {
      try {
        const savedConfig = JSON.parse(sessionStorage.getItem('solverConfig') || '{"mode":"casual","customTime":60,"showInstantFeedback":true}');
        setConfig(savedConfig);
        if (savedConfig.mode === 'exam') setTimeRemaining(savedConfig.customTime * 60);

        const paperRes = await papersAPI.getOne(paperId);
        const p = paperRes.data.paper;
        setPaper(p);
        setCorrectAnswers(p.answers || {});
        setTotalQuestions(p.totalQuestions || Object.keys(p.answers || {}).length || 40);
        setPdfUrl(`http://localhost:5000/api/papers/${paperId}/pdf/question`);

        try {
          const attemptRes = await attemptsAPI.start({ paperId, mode: savedConfig.mode, timeLimit: savedConfig.customTime * 60 });
          if (savedConfig.mode === 'exam') setTimeRemaining(attemptRes.data.remainingTime);
        } catch (e) { console.warn('Could not start attempt session:', e); }

        setIsRunning(true);
        setStartTime(Date.now());
      } catch (err) {
        toast.error('Failed to load paper');
        navigate('/upload');
      } finally {
        setLoading(false);
      }
    };
    loadPaper();
  }, [paperId]);

  // Timer
  useEffect(() => {
    if (!isRunning || submitted) return;
    const interval = setInterval(() => {
      if (config.mode === 'exam') {
        setTimeRemaining(prev => {
          if (prev <= 1) { clearInterval(interval); handleSubmit(); return 0; }
          return prev - 1;
        });
      } else {
        setElapsedDisplay(startTime ? Math.round((Date.now() - startTime) / 1000) : 0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [config.mode, isRunning, submitted, startTime]);

  // Fabric canvas init
  useEffect(() => {
    if (!showAnnotationBar || !canvasRef.current) return;

    let disposed = false;
    const initFabric = async () => {
      const fabric = await import('fabric');
      if (disposed) return;

      if (fabricRef.current) {
        try { fabricRef.current.dispose(); } catch (e) { /* ignore */ }
        fabricRef.current = null;
      }

      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true, selection: true, backgroundColor: 'transparent'
      });
      fabricRef.current = canvas;
      fabricInitialized.current = true;

      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = brushColor;
      canvas.freeDrawingBrush.width = brushSize;

      const saved = annotationsMapRef.current[currentPage];
      if (saved) {
        canvas.loadFromJSON(saved, () => { canvas.renderAll(); resizeCanvas(); });
      } else {
        resizeCanvas();
      }
    };

    initFabric();

    return () => {
      disposed = true;
      if (fabricRef.current) {
        saveAnnotations();
        try { fabricRef.current.dispose(); } catch (e) { /* ignore */ }
        fabricRef.current = null;
        fabricInitialized.current = false;
      }
    };
  }, [showAnnotationBar, currentPage]);

  // Update brush
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const update = async () => {
      const fabric = await import('fabric');
      if (activeTool === 'draw' || activeTool === 'highlighter') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = activeTool === 'highlighter' ? brushColor + '55' : brushColor;
        canvas.freeDrawingBrush.width = activeTool === 'highlighter' ? brushSize * 4 : brushSize;
      } else {
        canvas.isDrawingMode = false;
      }
    };
    update();
  }, [activeTool, brushColor, brushSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (submitted) return;
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) handleSelectAnswer(currentQuestionNum, key);
      else if (e.key === 'ArrowLeft' && currentQuestionNum > 1) setCurrentQuestionNum(n => n - 1);
      else if (e.key === 'ArrowRight' && currentQuestionNum < totalQuestions) setCurrentQuestionNum(n => n + 1);
      else if (key === 'F') toggleFlag(currentQuestionNum);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestionNum, submitted, totalQuestions]);

  const resizeCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    const container = pdfContainerRef.current;
    if (!canvas || !container) return;
    const pdfPage = container.querySelector('.react-pdf__Page');
    if (pdfPage?.offsetWidth > 0) {
      canvas.setDimensions({ width: pdfPage.offsetWidth, height: pdfPage.offsetHeight });
      canvas.renderAll();
    }
  }, []);

  const saveAnnotations = () => {
    if (fabricRef.current) annotationsMapRef.current[currentPage] = fabricRef.current.toJSON();
  };

  const handleSelectAnswer = (qNum, answer) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({ ...prev, [qNum]: prev[qNum] === answer ? null : answer }));
    if (config.mode === 'casual' && config.showInstantFeedback) {
      setRevealedAnswers(prev => ({ ...prev, [qNum]: true }));
    }
  };

  const toggleFlag = (qNum) => setFlaggedQuestions(prev => ({ ...prev, [qNum]: !prev[qNum] }));

  const handleSubmit = async () => {
    if (submitted) return;
    if (config.mode !== 'exam' && !window.confirm("Submit your paper?")) return;
    setSubmitted(true); setIsRunning(false);
    saveAnnotations();
    const allRevealed = {};
    for (let i = 1; i <= totalQuestions; i++) allRevealed[i] = true;
    setRevealedAnswers(allRevealed);
    try {
      const answersPayload = {};
      for (let i = 1; i <= totalQuestions; i++) answersPayload[i] = selectedAnswers[i] || null;
      const totalTime = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      const res = await attemptsAPI.submit({
        paperId, mode: config.mode, answers: answersPayload,
        totalTimeTaken: totalTime, examDuration: config.customTime * 60,
        annotations: annotationsMapRef.current
      });
      navigate(`/results/${res.data.attempt.id}`);
    } catch (err) { toast.error('Failed to save results'); }
  };

  const changePage = (newPage) => {
    if (newPage < 1 || newPage > numPages) return;
    saveAnnotations();
    setCurrentPage(newPage);
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const answeredCount = Object.values(selectedAnswers).filter(Boolean).length;
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface border-t-accent rounded-full animate-spin" />
        <p className="text-secondary font-medium">Preparing your workspace...</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden font-sans select-none">

      {/* ─── Compact Header ─── */}
      <header className="h-12 border-b border-border flex items-center justify-between px-5 shrink-0 z-30 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/upload')} className="font-extrabold text-accent tracking-tight text-sm hover:opacity-80 transition-opacity">
            PaperSolve
          </button>
          <div className="w-px h-5 bg-border" />
          <h1 className="text-xs font-semibold text-primary truncate max-w-[220px]">{paper?.title}</h1>
          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${config.mode === 'exam' ? 'bg-red-50 text-error border border-red-100' : 'bg-emerald-50 text-success border border-emerald-100'}`}>
            {config.mode}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums ${config.mode === 'exam' && timeRemaining < 300 ? 'text-error animate-pulse' : 'text-primary'}`}>
            <Clock size={14} />
            {config.mode === 'exam' ? formatTime(timeRemaining) : formatTime(elapsedDisplay)}
          </div>
          <button onClick={handleSubmit}
            className="bg-accent hover:bg-accent-hover text-white text-[11px] font-bold px-4 py-1.5 rounded-lg transition-all shadow-sm active:scale-95">
            Submit
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">

        {/* ─── PDF Panel ─── */}
        <Panel defaultSize={pdfPanelSize} minSize={40}
          onResize={(size) => { setPdfPanelSize(size); localStorage.setItem(storageKey, size.toString()); }}>
          <div className="h-full flex flex-col bg-surface relative overflow-hidden">

            {/* PDF scroll area — full height, no toolbar above */}
            <div className="flex-1 overflow-auto flex justify-center py-6 px-4" ref={pdfContainerRef}>
              <div className="relative shadow-lg bg-white border border-border/60 inline-block rounded-sm pdf-page-wrapper">
                {pdfFile && (
                  <Document
                    file={pdfFile}
                    onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                    loading={<div className="p-20 text-center text-secondary text-sm">Loading PDF...</div>}
                  >
                    <Page
                      pageNumber={currentPage} scale={scale}
                      renderAnnotationLayer={false} renderTextLayer={true}
                      onRenderSuccess={resizeCanvas}
                      loading={<div className="p-20 text-center text-secondary text-sm">Rendering...</div>}
                    />
                  </Document>
                )}
                {/* Canvas overlay — absolutely positioned over the PDF via CSS fix */}
                {showAnnotationBar && (
                  <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" style={{ zIndex: 10 }} />
                )}
              </div>
            </div>

            {/* ─── Floating Annotation Toolbar (top of PDF area) ─── */}
            {showAnnotationBar && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-border shadow-xl rounded-2xl px-4 py-2 flex items-center gap-2 z-20">
                {['draw', 'highlighter'].map(t => (
                  <button key={t} onClick={() => setActiveTool(t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${activeTool === t ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:bg-surface'}`}>
                    {t === 'draw' ? '✏️ Draw' : '🖍️ Highlight'}
                  </button>
                ))}
                <div className="w-px h-4 bg-border" />
                {['#111827','#4F46E5','#DC2626','#059669'].map(c => (
                  <button key={c} onClick={() => setBrushColor(c)}
                    className={`w-4 h-4 rounded-full transition-transform ${brushColor === c ? 'ring-2 ring-offset-1 ring-accent scale-125' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <div className="w-px h-4 bg-border" />
                <input type="range" min="1" max="10" value={brushSize} onChange={e => setBrushSize(+e.target.value)} className="w-16 accent-accent h-1" />
                <div className="w-px h-4 bg-border" />
                <button onClick={() => { if (fabricRef.current) { fabricRef.current.clear(); fabricRef.current.backgroundColor = 'transparent'; fabricRef.current.renderAll(); } }}
                  className="text-[11px] text-secondary hover:text-error font-medium px-1.5 py-0.5 rounded transition-colors">Clear</button>
                <button onClick={() => { saveAnnotations(); setShowAnnotationBar(false); }}
                  className="p-1 text-secondary hover:text-primary rounded-full hover:bg-surface transition-colors"><X size={14} /></button>
              </div>
            )}

            {/* ─── Floating Page Nav (bottom of PDF area) ─── */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-border shadow-xl rounded-2xl px-4 py-2 flex items-center gap-3 z-20">
              <button onClick={() => changePage(currentPage - 1)} disabled={currentPage <= 1}
                className="p-1 hover:bg-surface rounded-full disabled:opacity-30 transition-colors"><ChevronLeft size={16}/></button>
              <span className="text-[11px] font-semibold min-w-[50px] text-center tabular-nums">{currentPage} / {numPages}</span>
              <button onClick={() => changePage(currentPage + 1)} disabled={currentPage >= numPages}
                className="p-1 hover:bg-surface rounded-full disabled:opacity-30 transition-colors"><ChevronRight size={16}/></button>
              <div className="w-px h-4 bg-border" />
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-surface text-secondary hover:text-primary transition-colors">
                <ZoomOut size={13} />
              </button>
              <span className="text-[10px] font-mono w-7 text-center tabular-nums">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.2))}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-surface text-secondary hover:text-primary transition-colors">
                <ZoomIn size={13} />
              </button>
              <div className="w-px h-4 bg-border" />
              <button onClick={() => setShowAnnotationBar(!showAnnotationBar)}
                className={`p-1.5 rounded-full transition-all ${showAnnotationBar ? 'text-white bg-accent shadow-sm' : 'text-secondary hover:text-primary hover:bg-surface'}`}
                title="Annotate">
                <Pencil size={14} />
              </button>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-accent/50 transition-colors cursor-col-resize z-40" />

        {/* ─── Right Panel: Answer Selection ─── */}
        <Panel defaultSize={30} minSize={20}>
          <div className="h-full bg-white flex flex-col">

            {/* Question header — compact */}
            <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-secondary uppercase tracking-wider">Q {currentQuestionNum} / {totalQuestions}</span>
                <button onClick={() => toggleFlag(currentQuestionNum)}
                  className={`p-1.5 rounded-lg transition-colors ${flaggedQuestions[currentQuestionNum] ? 'text-amber-500 bg-amber-50' : 'text-muted hover:bg-surface hover:text-secondary'}`}>
                  <Flag size={14} fill={flaggedQuestions[currentQuestionNum] ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="h-1 w-full bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-500 rounded-full"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }} />
              </div>
            </div>

            {/* Answer options — centered, no scroll needed */}
            <div className="flex-1 px-5 py-4 flex flex-col justify-center overflow-y-auto">
              <p className="text-xs text-secondary mb-3">Select your answer for Question {currentQuestionNum}.</p>
              <div className="space-y-2">
                {['A', 'B', 'C', 'D'].map(opt => {
                  const isSelected = selectedAnswers[currentQuestionNum] === opt;
                  const isRevealed = revealedAnswers[currentQuestionNum];
                  const isCorrect = correctAnswers[currentQuestionNum] === opt;

                  let cardClass = "w-full flex items-center p-3 rounded-xl border-2 transition-all cursor-pointer group ";
                  if (isRevealed) {
                    if (isCorrect) cardClass += "border-success bg-emerald-50 text-success";
                    else if (isSelected) cardClass += "border-error bg-red-50 text-error";
                    else cardClass += "border-border opacity-50";
                  } else {
                    if (isSelected) cardClass += "border-accent bg-indigo-50/60 text-accent";
                    else cardClass += "border-border hover:border-accent/40 bg-white text-primary hover:bg-surface";
                  }

                  return (
                    <button key={opt} onClick={() => handleSelectAnswer(currentQuestionNum, opt)} className={cardClass}>
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mr-3 shrink-0 font-bold text-xs transition-colors ${isSelected ? 'bg-accent border-accent text-white' : 'border-border group-hover:border-accent/60 text-secondary'}`}>
                        {opt}
                      </div>
                      <span className="text-sm font-semibold">Option {opt}</span>
                      {isRevealed && isCorrect && <CheckCircle2 size={16} className="ml-auto text-success" />}
                      {isRevealed && isSelected && !isCorrect && <XCircle size={16} className="ml-auto text-error" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Footer Nav — always visible, never obscured ─── */}
            <div className="px-4 py-3 bg-surface/80 border-t border-border shrink-0">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setCurrentQuestionNum(n => Math.max(1, n - 1))} disabled={currentQuestionNum <= 1}
                  className="flex items-center gap-1 px-3 py-2 hover:bg-white rounded-lg disabled:opacity-30 border border-transparent hover:border-border transition-all text-xs font-semibold text-secondary">
                  <ChevronLeft size={14}/> Prev
                </button>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setShowGrid(!showGrid)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showGrid ? 'bg-accent text-white shadow-sm' : 'bg-white border border-border text-primary hover:bg-gray-50'}`}>
                    <Grid size={13}/> {showGrid ? 'Hide' : 'Grid'}
                  </button>
                  <button onClick={() => setShowRoughPage(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-border text-accent hover:bg-indigo-50 transition-all">
                    <Pencil size={13}/> Rough
                  </button>
                </div>
                <button onClick={() => setCurrentQuestionNum(n => Math.min(totalQuestions, n + 1))} disabled={currentQuestionNum >= totalQuestions}
                  className="flex items-center gap-1 px-3 py-2 hover:bg-white rounded-lg disabled:opacity-30 border border-transparent hover:border-border transition-all text-xs font-semibold text-secondary">
                  Next <ChevronRight size={14}/>
                </button>
              </div>

              {/* Question grid */}
              {showGrid && (
                <div className="grid grid-cols-5 gap-1.5 pt-3 mt-2 border-t border-border max-h-[180px] overflow-y-auto">
                  {Array.from({ length: totalQuestions }, (_, i) => i + 1).map(qNum => (
                    <button key={qNum} onClick={() => { setCurrentQuestionNum(qNum); setShowGrid(false); }}
                      className={`h-8 rounded-md flex items-center justify-center text-[10px] font-bold transition-all border relative
                        ${currentQuestionNum === qNum ? 'ring-2 ring-accent ring-offset-1' : ''}
                        ${selectedAnswers[qNum] ? 'bg-accent border-accent text-white' : 'bg-white border-border text-secondary hover:bg-gray-50'}`}>
                      {qNum}
                      {flaggedQuestions[qNum] && <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white ${selectedAnswers[qNum] ? 'bg-amber-400' : 'bg-amber-500'}`} />}
                    </button>
                  ))}
                </div>
              )}

              {/* Submit area — shows when on last question */}
              {currentQuestionNum === totalQuestions && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-secondary">Attempted: <strong className="text-primary">{answeredCount}/{totalQuestions}</strong></span>
                    <span className="text-secondary">Flagged: <strong className="text-amber-600">{flaggedCount}</strong></span>
                  </div>
                  <button onClick={handleSubmit}
                    className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98] text-sm">
                    Submit Paper
                  </button>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>

      {/* Rough Page */}
      {showRoughPage && <RoughPage onClose={() => setShowRoughPage(false)} />}
    </div>
  );
}

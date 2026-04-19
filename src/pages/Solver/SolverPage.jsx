import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { papersAPI, attemptsAPI } from '../../services/api';
import DrawingToolbar from '../../components/DrawingToolbar';
import RoughPage from '../../components/RoughPage';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './SolverPage.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function SolverPage() {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [paper, setPaper] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const pdfContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const [activeTool, setActiveTool] = useState('select');
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(3);
  const annotationsMapRef = useRef({});
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [correctAnswers, setCorrectAnswers] = useState({});
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [config, setConfig] = useState({ mode: 'casual', customTime: 60, showInstantFeedback: true });
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const questionStartRef = useRef(Date.now());
  const [questionTimes, setQuestionTimes] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [showRoughPage, setShowRoughPage] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const loadPaper = async () => {
      try {
        const savedConfig = JSON.parse(sessionStorage.getItem('solverConfig') || '{}');
        setConfig(savedConfig);
        if (savedConfig.mode === 'exam') setTimeRemaining(savedConfig.customTime * 60);

        if (paperId.startsWith('guest-')) {
          const guestDataStr = sessionStorage.getItem('guestPaperData');
          if (!guestDataStr) throw new Error('Guest data not found');
          const guestData = JSON.parse(guestDataStr);
          setPaper({ title: guestData.title, isGuest: true, subject: 'Guest Paper' });
          setCorrectAnswers({}); // Guest mode doesn't parse marking scheme yet
          setPdfUrl(guestData.questionPaperBlob);
        } else {
          const paperRes = await papersAPI.getOne(paperId);
          setPaper(paperRes.data.paper);
          setCorrectAnswers(paperRes.data.paper.answers);
          const pdfRes = await papersAPI.getPDF(paperId, 'question');
          setPdfUrl(URL.createObjectURL(pdfRes.data));
        }

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

  useEffect(() => {
    if (config.mode !== 'exam' || !isRunning || submitted) return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(interval); handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [config.mode, isRunning, submitted]);

  useEffect(() => {
    if (submitted) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [submitted]);

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;
    const initFabric = async () => {
      const fabric = await import('fabric');
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: false, selection: true, backgroundColor: 'transparent'
      });
      fabricRef.current = canvas;
      updateCanvasSize();
    };
    initFabric();
    return () => { if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; } };
  }, [pdfUrl]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const updateTool = async () => {
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
    updateTool();
  }, [activeTool, brushColor, brushSize]);

  const updateCanvasSize = () => {
    const canvas = fabricRef.current;
    const container = pdfContainerRef.current;
    if (!canvas || !container) return;
    const pdfPage = container.querySelector('.react-pdf__Page');
    if (pdfPage) { canvas.setWidth(pdfPage.offsetWidth); canvas.setHeight(pdfPage.offsetHeight); canvas.renderAll(); }
  };

  const saveCurrentPageAnnotations = () => {
    if (fabricRef.current) annotationsMapRef.current[currentPage] = fabricRef.current.toJSON();
  };

  const loadPageAnnotations = (pageNum) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const saved = annotationsMapRef.current[pageNum];
    if (saved) canvas.loadFromJSON(saved, () => canvas.renderAll());
    else { canvas.clear(); canvas.renderAll(); }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > numPages) return;
    saveCurrentPageAnnotations();
    setCurrentPage(newPage);
    setTimeout(() => { loadPageAnnotations(newPage); updateCanvasSize(); }, 100);
  };

  const addShape = async (type) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const fabric = await import('fabric');
    const c = { x: canvas.width / 2, y: canvas.height / 2 };
    let shape;
    if (type === 'rect') shape = new fabric.Rect({ left: c.x - 50, top: c.y - 30, width: 100, height: 60, fill: 'transparent', stroke: brushColor, strokeWidth: 2 });
    else if (type === 'circle') shape = new fabric.Ellipse({ left: c.x - 40, top: c.y - 40, rx: 40, ry: 40, fill: 'transparent', stroke: brushColor, strokeWidth: 2 });
    else if (type === 'line') shape = new fabric.Line([c.x - 60, c.y, c.x + 60, c.y], { stroke: brushColor, strokeWidth: 2 });
    else if (type === 'text') shape = new fabric.IText('Type here', { left: c.x - 40, top: c.y - 10, fontSize: 16, fill: brushColor, fontFamily: 'Inter' });
    if (shape) { canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll(); setActiveTool('select'); }
  };

  const handleClearCanvas = () => { if (fabricRef.current) { fabricRef.current.clear(); fabricRef.current.renderAll(); } };
  const handleDeleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject(); canvas.renderAll();
  };

  const handleSelectAnswer = (q, answer) => {
    if (submitted) return;
    const now = Date.now();
    if (currentQuestion !== q) {
      setQuestionTimes(prev => ({ ...prev, [currentQuestion]: (prev[currentQuestion] || 0) + (now - questionStartRef.current) / 1000 }));
      setCurrentQuestion(q); questionStartRef.current = now;
    }
    setSelectedAnswers(prev => ({ ...prev, [q]: answer }));
    if (config.mode === 'casual' && config.showInstantFeedback) setRevealedAnswers(prev => ({ ...prev, [q]: true }));
  };

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true); setIsRunning(false);
    saveCurrentPageAnnotations();
    const allRevealed = {}; for (let i = 1; i <= 40; i++) allRevealed[i] = true;
    setRevealedAnswers(allRevealed);
    if (!isAuthenticated) { toast.info('Sign up to save your results!'); return; }
    try {
      const answersPayload = {};
      for (let i = 1; i <= 40; i++) { answersPayload[i] = selectedAnswers[i] || null; answersPayload[i + '_time'] = Math.round(questionTimes[i] || 0); }
      const totalTime = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      const res = await attemptsAPI.submit({ paperId, mode: config.mode, answers: answersPayload, totalTimeTaken: totalTime, examDuration: config.customTime * 60, annotations: annotationsMapRef.current });
      navigate(`/results/${res.data.attempt.id}`);
    } catch (err) { toast.error('Failed to save results'); }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const getAnswerStatus = (q) => {
    if (!selectedAnswers[q]) return 'unanswered';
    if (!revealedAnswers[q]) return 'selected';
    return selectedAnswers[q] === correctAnswers[q] ? 'correct' : 'wrong';
  };
  const answeredCount = Object.keys(selectedAnswers).length;

  if (loading) return <div className="solver-loading"><div className="spinner spinner-lg" /><p className="text-secondary">Loading paper...</p></div>;

  return (
    <div className="solver-page">
      <div className="solver-topbar">
        <div className="solver-topbar-left">
          <h3 className="solver-title">{paper?.title || 'Paper'}</h3>
          {paper?.subject && <span className="badge badge-accent">{paper.subject}</span>}
        </div>
        <div className="solver-topbar-center">
          {config.mode === 'exam' && (
            <div className={`timer-display ${timeRemaining < 600 ? 'timer-warning' : ''} ${timeRemaining < 120 ? 'timer-critical' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="timer-value">{formatTime(timeRemaining)}</span>
            </div>
          )}
          <div className="progress-info">
            <span className="text-secondary">{answeredCount}/40</span>
            <div className="progress-bar" style={{ width: '120px' }}><div className="progress-fill" style={{ width: `${(answeredCount / 40) * 100}%` }} /></div>
          </div>
        </div>
        <div className="solver-topbar-right">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRoughPage(!showRoughPage)}>Rough Page</button>
          {!submitted && <button className="btn btn-primary btn-sm" onClick={handleSubmit}>Submit</button>}
        </div>
      </div>
      <div className="solver-body">
        <div className="solver-pdf-section">
          <DrawingToolbar activeTool={activeTool} setActiveTool={setActiveTool} brushColor={brushColor} setBrushColor={setBrushColor} brushSize={brushSize} setBrushSize={setBrushSize} onAddShape={addShape} onClear={handleClearCanvas} onDelete={handleDeleteSelected} />
          <div className="pdf-viewer-container" ref={pdfContainerRef}>
            <div className="pdf-canvas-wrapper">
              {pdfUrl && <Document file={pdfUrl} onLoadSuccess={({ numPages: n }) => setNumPages(n)} loading={<div className="pdf-loading"><div className="spinner" /></div>}><Page pageNumber={currentPage} scale={scale} renderAnnotationLayer={false} renderTextLayer={false} onRenderSuccess={() => setTimeout(updateCanvasSize, 50)} /></Document>}
              <canvas ref={canvasRef} className="drawing-canvas" />
            </div>
          </div>
          <div className="pdf-nav">
            <button className="btn btn-ghost btn-sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>← Prev</button>
            <span className="page-indicator"><input type="number" className="page-input" value={currentPage} onChange={e => handlePageChange(parseInt(e.target.value) || 1)} min={1} max={numPages} /><span className="text-secondary">/ {numPages}</span></span>
            <div className="zoom-controls">
              <button className="btn btn-ghost btn-sm" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>−</button>
              <span className="text-secondary">{Math.round(scale * 100)}%</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setScale(s => Math.min(3, s + 0.1))}>+</button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= numPages}>Next →</button>
          </div>
        </div>
        <div className="mcq-panel">
          <div className="mcq-panel-header"><h3>Answer Sheet</h3>
            {submitted && <div className="mcq-score"><span className="text-gradient">{Object.entries(selectedAnswers).filter(([q, a]) => a === correctAnswers[q]).length}/40</span></div>}
          </div>
          <div className="mcq-questions-list">
            {Array.from({ length: 40 }, (_, i) => i + 1).map(q => {
              const status = getAnswerStatus(q);
              return (<div key={q} className={`mcq-question-row ${status}`}><span className="mcq-q-num">{q}</span><div className="mcq-options">{['A', 'B', 'C', 'D'].map(opt => {
                let cls = 'mcq-opt';
                if (selectedAnswers[q] === opt) cls += ' selected';
                if (revealedAnswers[q]) { if (opt === correctAnswers[q]) cls += ' correct'; if (selectedAnswers[q] === opt && opt !== correctAnswers[q]) cls += ' wrong'; }
                return <button key={opt} className={cls} onClick={() => handleSelectAnswer(q, opt)} disabled={submitted}>{opt}</button>;
              })}</div>{revealedAnswers[q] && <span className={`mcq-status-icon ${status}`}>{status === 'correct' ? '✓' : status === 'wrong' ? '✕' : ''}</span>}</div>);
            })}
          </div>
          {!submitted && <div className="mcq-panel-footer"><button className="btn btn-primary" onClick={handleSubmit} style={{ width: '100%' }}>Submit ({answeredCount}/40)</button></div>}
        </div>
      </div>
      {showRoughPage && <RoughPage onClose={() => setShowRoughPage(false)} />}
    </div>
  );
}

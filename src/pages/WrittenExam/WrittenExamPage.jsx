import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, ArrowRight, Clock3, Cloud, CloudOff, Maximize2, Minimize2, Moon, Save, Send, ShieldAlert, Sun } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { writtenAttemptsAPI, writtenLibraryAPI } from '../../services/api';
import { readWrittenDraft, removeWrittenDraft, saveWrittenDraft } from '../../services/writtenDraftStore';
import DrawingToolbar from '../../components/DrawingToolbar';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './WrittenExamPage.css';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function formatSeconds(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(safe / 3600)).padStart(2, '0')}:${String(Math.floor((safe % 3600) / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function configureDrawingBrush(canvas, fabric, tool, color, size) {
  if (!['draw', 'highlighter', 'eraser'].includes(tool)) {
    canvas.isDrawingMode = false;
    return;
  }
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  canvas.freeDrawingBrush.color = tool === 'eraser' ? '#000000' : tool === 'highlighter' ? `${color}55` : color;
  canvas.freeDrawingBrush.width = tool === 'eraser' ? size * 5 : tool === 'highlighter' ? size * 4 : size;
}

export default function WrittenExamPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [attempt, setAttempt] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [saveState, setSaveState] = useState('saved');
  const [tick, setTick] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [activeTool, setActiveTool] = useState('draw');
  const [brushColor, setBrushColor] = useState('#173653');
  const [brushSize, setBrushSize] = useState(3);
  const [lightMode, setLightMode] = useState(() => {
    try { return localStorage.getItem('solvescript:written-paper-theme') === 'light'; } catch { return false; }
  });
  const [historyControls, setHistoryControls] = useState({ canUndo: false, canRedo: false });

  const stageRef = useRef(null);
  const canvasHostRef = useRef(null);
  const fabricRef = useRef(null);
  const pageStatesRef = useRef({});
  const displayedPageRef = useRef(1);
  const saveTimerRef = useRef(null);
  const pdfUrlRef = useRef('');
  const pageHistoryRef = useRef({});
  const pageSaveChainsRef = useRef({});
  const restoringHistoryRef = useRef(false);
  const activeToolRef = useRef('draw');
  const brushColorRef = useRef('#173653');
  const brushSizeRef = useRef(3);

  const syncHistoryControls = useCallback((pageNumber) => {
    if (pageNumber !== displayedPageRef.current) return;
    const history = pageHistoryRef.current[pageNumber];
    setHistoryControls({ canUndo: (history?.undo.length || 0) > 1, canRedo: (history?.redo.length || 0) > 0 });
  }, []);

  const recordHistory = useCallback((pageNumber, canvas) => {
    if (restoringHistoryRef.current) return;
    const snapshot = JSON.stringify(canvas.toJSON());
    const previous = pageHistoryRef.current[pageNumber] || { undo: [], redo: [] };
    if (previous.undo.at(-1) === snapshot) return;
    const history = { undo: [...previous.undo, snapshot].slice(-50), redo: [] };
    pageHistoryRef.current[pageNumber] = history;
    syncHistoryControls(pageNumber);
  }, [syncHistoryControls]);

  const updateCanvasSize = useCallback(() => {
    const canvas = fabricRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const width = Math.max(1, Math.ceil(stage.clientWidth));
    const height = Math.max(1, Math.ceil(stage.clientHeight));
    canvas.setDimensions({ width, height });
    canvas.calcOffset();
    canvas.renderAll();
    setPageSize({ width, height });
  }, []);

  const persistPage = useCallback((pageNumber, annotation) => {
    const pageState = pageStatesRef.current[pageNumber] || { revision: 0 };
    pageStatesRef.current[pageNumber] = { ...pageState, annotation };
    const previous = pageSaveChainsRef.current[pageNumber] || Promise.resolve();
    const save = previous.catch(() => {}).then(async () => {
      const currentState = pageStatesRef.current[pageNumber] || { revision: 0 };
      try {
        await saveWrittenDraft({ attemptId, pageNumber, annotation, revision: currentState.revision || 0 });
      } catch {
        // The server save still protects the student when IndexedDB is unavailable.
      }
      setSaveState(navigator.onLine ? 'saving' : 'offline');
      try {
        const response = await writtenAttemptsAPI.savePage(attemptId, pageNumber, {
          annotation,
          expectedRevision: currentState.revision || 0,
        });
        const latest = pageStatesRef.current[pageNumber] || {};
        pageStatesRef.current[pageNumber] = { ...latest, revision: response.data.page.revision };
        if (latest.annotation === annotation) await removeWrittenDraft(attemptId, pageNumber).catch(() => {});
        setSaveState('saved');
      } catch (error) {
        if (error.response?.status === 409) {
          setSaveState('conflict');
          toast.error('This page changed on another device. Your local draft has been kept.');
          return;
        }
        setSaveState('offline');
      }
    });
    pageSaveChainsRef.current[pageNumber] = save;
    return save;
  }, [attemptId, toast]);

  const saveCanvas = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    const pageNumber = displayedPageRef.current;
    await persistPage(pageNumber, canvas.toJSON());
  }, [persistPage]);

  const queueSave = useCallback(() => {
    if (!fabricRef.current) return;
    const pageNumber = displayedPageRef.current;
    const annotation = fabricRef.current.toJSON();
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => { void persistPage(pageNumber, annotation); }, 900);
  }, [persistPage]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await writtenAttemptsAPI.getOne(attemptId);
        if (!active) return;
        const loadedAttempt = response.data.attempt;
        setAttempt(loadedAttempt);
        setSessionStartedAt(Date.now());
        setCurrentPage(loadedAttempt.currentPage || 1);
        displayedPageRef.current = loadedAttempt.currentPage || 1;
        for (const page of loadedAttempt.pages || []) {
          pageStatesRef.current[page.pageNumber] = { annotation: page.annotation, revision: page.revision, updatedAt: page.updatedAt };
        }
        const pdfResponse = await writtenLibraryAPI.getPDF(loadedAttempt.paper.paperId);
        const nextUrl = URL.createObjectURL(pdfResponse.data);
        pdfUrlRef.current = nextUrl;
        if (active) setPdfUrl(nextUrl);
      } catch (error) {
        if (active) toast.error(error.response?.data?.message || 'Your written attempt could not be opened.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, [attemptId, toast]);

  useEffect(() => {
    try { localStorage.setItem('solvescript:written-paper-theme', lightMode ? 'light' : 'dark'); } catch { /* Theme remains active for this visit. */ }
  }, [lightMode]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!renderedPage || renderedPage !== currentPage || !canvasHostRef.current) return undefined;
    let cancelled = false;
    let canvas;
    const host = canvasHostRef.current;
    const canvasElement = document.createElement('canvas');
    host.replaceChildren(canvasElement);

    const initialise = async () => {
      const fabric = await import('fabric');
      if (cancelled) return;
      canvas = new fabric.Canvas(canvasElement, { isDrawingMode: true, selection: true, backgroundColor: 'transparent' });
      fabricRef.current = canvas;
      updateCanvasSize();
      configureDrawingBrush(canvas, fabric, activeToolRef.current, brushColorRef.current, brushSizeRef.current);
      const remoteState = pageStatesRef.current[currentPage];
      const localState = await readWrittenDraft(attemptId, currentPage).catch(() => null);
      if (cancelled) return;
      const selected = localState?.annotation || remoteState?.annotation;
      if (selected) await canvas.loadFromJSON(selected);
      if (!cancelled) canvas.renderAll();
      if (!pageHistoryRef.current[currentPage]) {
        pageHistoryRef.current[currentPage] = { undo: [JSON.stringify(canvas.toJSON())], redo: [] };
      }
      syncHistoryControls(currentPage);
      const changed = (event) => {
        if (event?.path && activeToolRef.current === 'eraser') {
          event.path.globalCompositeOperation = 'destination-out';
          event.path.selectable = false;
          event.path.evented = false;
          canvas.renderAll();
        }
        recordHistory(currentPage, canvas);
        queueSave();
      };
      canvas.on('path:created', changed);
      canvas.on('object:modified', changed);
      canvas.on('object:added', (event) => { if (event.target?.type !== 'path') changed(event); });
      canvas.on('object:removed', changed);
    };
    void initialise();

    return () => {
      cancelled = true;
      if (canvas) canvas.dispose();
      if (fabricRef.current === canvas) fabricRef.current = null;
    };
  }, [attemptId, currentPage, queueSave, recordHistory, renderedPage, syncHistoryControls, updateCanvasSize]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let cancelled = false;
    (async () => {
      const fabric = await import('fabric');
      if (cancelled || !fabricRef.current) return;
      configureDrawingBrush(canvas, fabric, activeTool, brushColor, brushSize);
    })();
    return () => { cancelled = true; };
  }, [activeTool, brushColor, brushSize, renderedPage]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    brushColorRef.current = brushColor;
    brushSizeRef.current = brushSize;
  }, [brushColor, brushSize]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => updateCanvasSize());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [renderedPage, updateCanvasSize]);

  useEffect(() => {
    const saveOnLeave = () => { void saveCanvas(); };
    const saveOnVisibility = () => { if (document.visibilityState === 'hidden') void saveCanvas(); };
    window.addEventListener('pagehide', saveOnLeave);
    document.addEventListener('visibilitychange', saveOnVisibility);
    return () => {
      window.removeEventListener('pagehide', saveOnLeave);
      document.removeEventListener('visibilitychange', saveOnVisibility);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [saveCanvas]);

  const changePage = async (pageNumber) => {
    if (pageNumber < 1 || pageNumber > numPages || pageNumber === currentPage) return;
    await saveCanvas();
    displayedPageRef.current = pageNumber;
    setRenderedPage(0);
    setCurrentPage(pageNumber);
    void writtenAttemptsAPI.update(attemptId, { currentPage: pageNumber }).catch(() => {});
  };

  const addShape = async (type) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const fabric = await import('fabric');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const base = { fill: 'transparent', stroke: brushColor, strokeWidth: 2 };
    let shape;
    if (type === 'rect') shape = new fabric.Rect({ ...base, left: centerX - 55, top: centerY - 30, width: 110, height: 60 });
    if (type === 'circle') shape = new fabric.Ellipse({ ...base, left: centerX - 42, top: centerY - 42, rx: 42, ry: 42 });
    if (type === 'line') shape = new fabric.Line([centerX - 65, centerY, centerX + 65, centerY], base);
    if (type === 'text') shape = new fabric.IText('Type here', { left: centerX - 40, top: centerY - 10, fontSize: 17, fill: brushColor, fontFamily: 'Manrope' });
    if (!shape) return;
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
    queueSave();
    setActiveTool('select');
  };

  const restoreHistory = useCallback(async (snapshot) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    restoringHistoryRef.current = true;
    try {
      await canvas.loadFromJSON(JSON.parse(snapshot));
      canvas.renderAll();
    } finally {
      restoringHistoryRef.current = false;
    }
    queueSave();
  }, [queueSave]);

  const undo = async () => {
    const history = pageHistoryRef.current[displayedPageRef.current];
    if (!history || history.undo.length < 2) return;
    const current = history.undo.at(-1);
    const nextHistory = { undo: history.undo.slice(0, -1), redo: [...history.redo, current] };
    pageHistoryRef.current[displayedPageRef.current] = nextHistory;
    await restoreHistory(nextHistory.undo.at(-1));
    syncHistoryControls(displayedPageRef.current);
  };

  const redo = async () => {
    const history = pageHistoryRef.current[displayedPageRef.current];
    if (!history?.redo.length) return;
    const next = history.redo.at(-1);
    const nextHistory = { undo: [...history.undo, next], redo: history.redo.slice(0, -1) };
    pageHistoryRef.current[displayedPageRef.current] = nextHistory;
    await restoreHistory(next);
    syncHistoryControls(displayedPageRef.current);
  };

  const finish = async () => {
    await saveCanvas();
    const elapsedSeconds = attempt.deadlineAt
      ? Math.max(0, Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000))
      : Math.max(0, Math.round((attempt.elapsedSeconds || 0) + (Date.now() - (sessionStartedAt || Date.now())) / 1000));
    try {
      const response = await writtenAttemptsAPI.update(attemptId, { status: 'submitted', elapsedSeconds });
      setAttempt(response.data.attempt);
      toast.success('Paper saved. Your review workspace is next.');
      navigate(`/written/results/${attemptId}`, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not finish this paper. Your draft remains saved.');
    }
  };

  const saveAndExit = async () => {
    if (!attempt) return;
    await saveCanvas();
    const elapsedSeconds = attempt.deadlineAt
      ? Math.max(0, Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000))
      : Math.max(0, Math.round((attempt.elapsedSeconds || 0) + (Date.now() - (sessionStartedAt || Date.now())) / 1000));
    try {
      await writtenAttemptsAPI.update(attemptId, { currentPage, elapsedSeconds });
      toast.success('Your paper is saved. You can resume it from your desk.');
      navigate('/written-library');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not confirm your saved paper. Your device draft remains available.');
    }
  };

  if (loading) return <div className="solver-loading"><div className="spinner spinner-lg" /><p>Opening your exam desk…</p></div>;
  if (!attempt || !pdfUrl) return <div className="solver-loading"><p>Your written paper could not be loaded.</p></div>;

  const clockNow = tick || new Date(attempt.startedAt).getTime();
  const examSeconds = attempt.deadlineAt
    ? Math.max(0, Math.round((new Date(attempt.deadlineAt).getTime() - clockNow) / 1000))
    : Math.max(0, Math.round((attempt.elapsedSeconds || 0) + (clockNow - (sessionStartedAt || clockNow)) / 1000));
  const isTimedOut = attempt.mode === 'exam' && examSeconds === 0;
  const editable = attempt.status === 'draft';

  return (
    <main className={`written-exam-page ${lightMode ? 'light' : ''}`}>
      <header className="written-exam-bar">
        <button className="written-exam-back" onClick={() => void saveAndExit()} aria-label="Save and leave written paper" title="Save and exit"><ArrowLeft size={18} /></button>
        <div className="written-exam-title"><span>WRITTEN PAPER / {attempt.paper.component}</span><h1>{attempt.paper.title}</h1></div>
        <div className={`written-exam-timer ${isTimedOut || (attempt.mode === 'exam' && examSeconds < 600) ? 'warning' : ''}`}><Clock3 size={17} /><div><small>{attempt.deadlineAt ? 'TIME REMAINING' : 'TIME ELAPSED'}</small><b>{formatSeconds(examSeconds)}</b></div></div>
        <div className="written-exam-save" role="status">{saveState === 'saved' && <><Cloud size={15} /> Saved</>}{saveState === 'saving' && <><Cloud size={15} /> Saving</>}{saveState === 'offline' && <><CloudOff size={15} /> Saved on device</>}{saveState === 'conflict' && <><ShieldAlert size={15} /> Review conflict</>}</div>
        <button className="written-save-exit" type="button" onClick={() => void saveAndExit()}><Save size={15} /> Save & exit</button>
        <button className="written-theme-toggle" type="button" onClick={() => setLightMode((value) => !value)} aria-label={lightMode ? 'Use dark paper mode' : 'Use light paper mode'} title={lightMode ? 'Dark paper mode' : 'Light paper mode'}>{lightMode ? <Moon size={16} /> : <Sun size={16} />}</button>
        <button className="written-finish" type="button" onClick={finish} disabled={!editable}>{editable ? (isTimedOut ? 'Time is up — finish' : 'Finish paper') : 'Paper finished'} <Send size={15} /></button>
      </header>

      <section className="written-exam-workspace">
        <aside className="written-page-rail" aria-label="Paper pages">
          <b>Pages</b>
          {Array.from({ length: numPages }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} className={pageNumber === currentPage ? 'active' : ''} onClick={() => changePage(pageNumber)} aria-label={`Go to paper page ${pageNumber}`} aria-current={pageNumber === currentPage ? 'page' : undefined}>{pageNumber}</button>)}
        </aside>
        <section className="written-paper-area" aria-label="Question paper annotation surface">
          {editable && <DrawingToolbar activeTool={activeTool} setActiveTool={setActiveTool} brushColor={brushColor} setBrushColor={setBrushColor} brushSize={brushSize} setBrushSize={setBrushSize} onAddShape={addShape} onUndo={undo} onRedo={redo} canUndo={historyControls.canUndo} canRedo={historyControls.canRedo} showDestructiveActions={false} />}
          <div className="written-paper-scroll">
            <div className="written-paper-zoom-shell" style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }}>
              <div className="written-paper-stage" ref={stageRef} style={{ transform: `scale(${zoom})` }}>
                <Document file={pdfUrl} loading={<div className="pdf-loading"><div className="spinner" /></div>} onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}>
                  <Page pageNumber={currentPage} scale={1} renderAnnotationLayer={false} renderTextLayer={false} onRenderSuccess={() => { setRenderedPage(currentPage); window.setTimeout(updateCanvasSize, 0); }} />
                </Document>
                <div className="written-annotation-host" ref={canvasHostRef} aria-hidden="true" />
              </div>
            </div>
          </div>
          <footer className="written-paper-controls">
            <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage <= 1}><ArrowLeft size={16} /> Previous</button>
            <span>Page {currentPage} of {numPages || '—'}</span>
            <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage >= numPages}>Next <ArrowRight size={16} /></button>
            <div className="written-zoom-controls"><button type="button" onClick={() => setZoom((value) => Math.max(.7, Number((value - .1).toFixed(1))))} aria-label="Zoom out" title="Zoom out"><Minimize2 size={15} /></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(2.2, Number((value + .1).toFixed(1))))} aria-label="Zoom in" title="Zoom in"><Maximize2 size={15} /></button></div>
          </footer>
        </section>
      </section>
    </main>
  );
}

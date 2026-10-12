import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Columns3,
  FileText,
  Flag,
  Maximize2,
  Minimize2,
  ScanLine,
  Send,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { attemptsAPI, libraryAPI, papersAPI } from '../../services/api';
import DrawingToolbar from '../../components/DrawingToolbar';
import StudioDialog from '../../components/studio/StudioDialog';
import PaperReport from './PaperReport';
import { buildReport, formatDuration } from './attemptReport';
import { accountKey, readSaved, saveLocalAttempt } from '../../components/studio/studyData';
import './SolverPage.css';

const PdfPaperPage = lazy(() => import('./PdfPaperPage'));

const OPTIONS = ['A', 'B', 'C', 'D'];
const ONGOING_TESTS_KEY = 'solvescript:ongoingTests';

function makeRevealed(totalQuestions) {
  return Array.from({ length: totalQuestions }, (_, index) => index + 1).reduce((acc, q) => {
    acc[q] = true;
    return acc;
  }, {});
}

function removeOngoingTest(path, owner) {
  try {
    const saved = JSON.parse(localStorage.getItem(ONGOING_TESTS_KEY) || '[]');
    const next = Array.isArray(saved) ? saved.filter((test) => test.path !== path || (test.owner || 'guest') !== owner) : [];
    if (next.length) localStorage.setItem(ONGOING_TESTS_KEY, JSON.stringify(next));
    else localStorage.removeItem(ONGOING_TESTS_KEY);
  } catch {
    // Storage may be unavailable; the result can still be displayed.
  }
}

export default function SolverPage() {
  const { paperId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const isLibraryPaper = location.pathname.includes('/solve/library/');
  const draftKey = `solvescript:draft:${accountKey(user)}:${isLibraryPaper ? 'library' : 'upload'}:${paperId}`;

  const [paper, setPaper] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [answerPanelWidth, setAnswerPanelWidth] = useState(360);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [correctAnswers, setCorrectAnswers] = useState({});
  const [discountedQuestions, setDiscountedQuestions] = useState([]);
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [config, setConfig] = useState({ mode: 'casual', customTime: 75, showInstantFeedback: true });
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [questionTimes, setQuestionTimes] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [localResult, setLocalResult] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [layoutMode, setLayoutMode] = useState('full');
  const [cropData, setCropData] = useState(null);
  const [cropLoading, setCropLoading] = useState(false);
  const [cropError, setCropError] = useState('');
  const [cloudDraftId, setCloudDraftId] = useState(null);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [historyControls, setHistoryControls] = useState({ canUndo: false, canRedo: false, canDelete: false, hasAnnotations: false });

  const annotationStageRef = useRef(null);
  const canvasHostRef = useRef(null);
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const annotationsMapRef = useRef({});
  const historyMapRef = useRef({});
  const restoringHistoryRef = useRef(false);
  const annotationLoadVersionRef = useRef(0);
  const currentCanvasKeyRef = useRef('page-1');
  const questionStartRef = useRef(null);
  const resizeStartRef = useRef(null);
  const deadlineRef = useRef(null);
  const submissionRef = useRef(false);
  const scrollRef = useRef(null);
  const zoomSurfaceRef = useRef(null);
  const scaleRef = useRef(1);
  const targetScaleRef = useRef(1);
  const zoomAnchorRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const wheelFrameRef = useRef(null);
  const wheelDeltaRef = useRef(0);
  const wheelPointRef = useRef(null);
  const cloudSaveTimerRef = useRef(null);
  const cloudDraftIdRef = useRef(null);
  const cropRequestRef = useRef(null);
  const pdfRequestRef = useRef(null);
  const pdfObjectUrlRef = useRef(null);
  const pdfUrlRef = useRef(null);
  const libraryDetailsRequestRef = useRef(null);
  const libraryDetailsLoadedRef = useRef(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [canvasReady, setCanvasReady] = useState(0);

  const [activeTool, setActiveTool] = useState('select');
  const [brushColor, setBrushColor] = useState('#ef565c');
  const [brushSize, setBrushSize] = useState(3);

  const totalQuestions = paper?.totalQuestions || 40;
  const discountedSet = useMemo(
    () => new Set(discountedQuestions.map((q) => Number(q))),
    [discountedQuestions],
  );
  const answeredCount = Object.keys(selectedAnswers).filter((q) => selectedAnswers[q]).length;
  const flaggedCount = Object.keys(flaggedQuestions).filter((q) => flaggedQuestions[q]).length;
  const unansweredCount = Array.from({ length: totalQuestions }, (_, index) => index + 1)
    .filter((q) => !discountedSet.has(q) && !selectedAnswers[q]).length;
  const activeCrop = useMemo(
    () => cropData?.questions?.find((crop) => Number(crop.question) === Number(currentQuestion)),
    [cropData, currentQuestion],
  );
  const currentCanvasKey = layoutMode === 'crop' ? `question-${currentQuestion}` : `page-${currentPage}`;
  const ongoingPath = isLibraryPaper ? `/solve/library/${paperId}` : `/solve/${paperId}`;

  useEffect(() => {
    currentCanvasKeyRef.current = currentCanvasKey;
  }, [currentCanvasKey]);

  useEffect(() => {
    cloudDraftIdRef.current = cloudDraftId;
  }, [cloudDraftId]);

  const updateCanvasSize = useCallback(() => {
    const canvas = fabricRef.current;
    const stage = annotationStageRef.current;
    if (!canvas || !stage) return;

    const width = Math.ceil(stage.offsetWidth || stage.scrollWidth || stage.clientWidth || 1);
    const height = Math.ceil(stage.offsetHeight || stage.scrollHeight || stage.clientHeight || 1);
    canvas.setDimensions({
      width,
      height,
    });
    canvas.setZoom(1);
    canvas.calcOffset();
    canvas.renderAll();
    setStageSize((previous) => (
      previous.width === width && previous.height === height
        ? previous
        : { width, height }
    ));
  }, []);

  const setZoomFromPoint = useCallback((nextScale, clientPoint = null) => {
    const clamped = Math.max(0.55, Math.min(2.4, Number(nextScale.toFixed(3))));
    const scroll = scrollRef.current;
    const oldScale = targetScaleRef.current || scaleRef.current || 1;

    if (scroll) {
      const bounds = scroll.getBoundingClientRect();
      const x = clientPoint ? clientPoint.clientX - bounds.left : scroll.clientWidth / 2;
      const y = clientPoint ? clientPoint.clientY - bounds.top : scroll.clientHeight / 2;
      zoomAnchorRef.current = {
        x,
        y,
        worldX: (scroll.scrollLeft + x) / oldScale,
        worldY: (scroll.scrollTop + y) / oldScale,
      };
    }

    targetScaleRef.current = clamped;
    setScale(clamped);
  }, []);

  const saveCurrentAnnotations = useCallback(() => {
    if (!fabricRef.current) return;
    annotationsMapRef.current[currentCanvasKey] = fabricRef.current.toJSON();
  }, [currentCanvasKey]);

  const syncHistoryControls = useCallback((canvasKey = currentCanvasKeyRef.current) => {
    const history = historyMapRef.current[canvasKey];
    const canvas = fabricRef.current;
    setHistoryControls({
      canUndo: Boolean(history && history.index > 0),
      canRedo: Boolean(history && history.index < history.entries.length - 1),
      canDelete: Boolean(canvas?.getActiveObjects().length),
      hasAnnotations: Boolean(canvas?.getObjects().length),
    });
  }, []);

  const createHistoryEntry = useCallback((canvasKey, canvas) => {
    const snapshot = canvas.toJSON();
    if (!historyMapRef.current[canvasKey]) {
      historyMapRef.current[canvasKey] = { entries: [snapshot], index: 0 };
    }
    syncHistoryControls(canvasKey);
    return snapshot;
  }, [syncHistoryControls]);

  const recordAnnotationHistory = useCallback(() => {
    const canvas = fabricRef.current;
    const canvasKey = currentCanvasKeyRef.current;
    if (!canvas || restoringHistoryRef.current) return;
    const snapshot = canvas.toJSON();
    const previousHistory = historyMapRef.current[canvasKey] || { entries: [], index: -1 };
    const current = previousHistory.entries[previousHistory.index];
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
    const entries = [...previousHistory.entries.slice(0, previousHistory.index + 1), snapshot].slice(-60);
    historyMapRef.current[canvasKey] = { entries, index: entries.length - 1 };
    annotationsMapRef.current[canvasKey] = snapshot;
    syncHistoryControls(canvasKey);
  }, [syncHistoryControls]);

  const restoreHistory = useCallback(async (direction) => {
    const canvas = fabricRef.current;
    const canvasKey = currentCanvasKeyRef.current;
    const history = historyMapRef.current[canvasKey];
    const nextIndex = history?.index + direction;
    if (!canvas || !history || nextIndex < 0 || nextIndex >= history.entries.length) return;
    restoringHistoryRef.current = true;
    try {
      await canvas.loadFromJSON(history.entries[nextIndex]);
      if (!canvas.disposed) canvas.renderAll();
      annotationsMapRef.current[canvasKey] = history.entries[nextIndex];
      historyMapRef.current[canvasKey] = { ...history, index: nextIndex };
    } finally {
      restoringHistoryRef.current = false;
      syncHistoryControls(canvasKey);
    }
  }, [syncHistoryControls]);

  const loadAnnotations = useCallback((canvasKey) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const version = ++annotationLoadVersionRef.current;
    const isCurrentLoad = () => (
      version === annotationLoadVersionRef.current
      && fabricRef.current === canvas
      && currentCanvasKeyRef.current === canvasKey
      && !canvas.disposed
    );

    const saved = annotationsMapRef.current[canvasKey];
    if (saved) {
      void canvas.loadFromJSON(saved).then(() => {
        if (!isCurrentLoad()) return;
        canvas.renderAll();
        createHistoryEntry(canvasKey, canvas);
      }).catch(() => {
        if (!isCurrentLoad()) return;
        canvas.clear();
        canvas.renderAll();
        createHistoryEntry(canvasKey, canvas);
      });
      return;
    }

    canvas.clear();
    canvas.renderAll();
    createHistoryEntry(canvasKey, canvas);
  }, [createHistoryEntry]);

  const disposeFabricCanvas = useCallback(() => {
    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }
    canvasRef.current = null;
    if (canvasHostRef.current) {
      canvasHostRef.current.replaceChildren();
    }
  }, []);

  const clearQuestionPaper = useCallback(() => {
    if (pdfObjectUrlRef.current) URL.revokeObjectURL(pdfObjectUrlRef.current);
    pdfObjectUrlRef.current = null;
    pdfRequestRef.current = null;
    pdfUrlRef.current = null;
    setPdfUrl(null);
    setPdfLoading(false);
    setPdfError('');
  }, []);

  const loadQuestionPaper = useCallback(async () => {
    if (pdfUrlRef.current || paperId.startsWith('guest-')) return pdfUrlRef.current;
    if (pdfRequestRef.current?.paperId === paperId) return pdfRequestRef.current.promise;

    setPdfLoading(true);
    setPdfError('');
    const request = (isLibraryPaper
      ? libraryAPI.getPDF(paperId, 'question')
      : papersAPI.getPDF(paperId, 'question'))
      .then((response) => {
        if (pdfRequestRef.current?.promise !== request) return null;
        const nextUrl = URL.createObjectURL(response.data);
        pdfObjectUrlRef.current = nextUrl;
        pdfUrlRef.current = nextUrl;
        setPdfUrl(nextUrl);
        return nextUrl;
      })
      .catch((error) => {
        if (pdfRequestRef.current?.promise === request) {
          setPdfError('The question paper could not be loaded. Please try again.');
        }
        throw error;
      })
      .finally(() => {
        if (pdfRequestRef.current?.promise === request) {
          pdfRequestRef.current = null;
          setPdfLoading(false);
        }
      });
    pdfRequestRef.current = { paperId, promise: request };
    return request;
  }, [isLibraryPaper, paperId]);

  const loadLibraryDetails = useCallback(async () => {
    if (!isLibraryPaper || libraryDetailsLoadedRef.current) return null;
    if (libraryDetailsRequestRef.current?.paperId === paperId) {
      return libraryDetailsRequestRef.current.promise;
    }

    const request = libraryAPI.getOne(paperId)
      .then((response) => {
        if (libraryDetailsRequestRef.current?.promise !== request) return null;
        const detailedPaper = response.data.paper;
        libraryDetailsLoadedRef.current = true;
        setPaper((current) => ({ ...current, ...detailedPaper, isLibrary: true }));
        setCorrectAnswers(detailedPaper.answers || {});
        setDiscountedQuestions(detailedPaper.discountedQuestions || []);
        return detailedPaper;
      })
      .finally(() => {
        if (libraryDetailsRequestRef.current?.promise === request) {
          libraryDetailsRequestRef.current = null;
        }
      });
    libraryDetailsRequestRef.current = { paperId, promise: request };
    return request;
  }, [isLibraryPaper, paperId]);

  useEffect(() => () => {
    if (pdfObjectUrlRef.current) URL.revokeObjectURL(pdfObjectUrlRef.current);
  }, []);

  const scoreAttempt = useCallback(() => {
    const now = Date.now();
    const times = { ...questionTimes, [currentQuestion]: (questionTimes[currentQuestion] || 0) + (questionStartRef.current ? (now - questionStartRef.current) / 1000 : 0) };
    return buildReport({ totalQuestions, selectedAnswers, correctAnswers, discountedQuestions, questionTimes: times, totalTimeTaken: startTime ? Math.round((now - startTime) / 1000) : 0, componentThreshold: paper?.componentThreshold || null });
  }, [correctAnswers, discountedQuestions, questionTimes, selectedAnswers, totalQuestions, currentQuestion, startTime, paper]);

  const saveDraftNow = useCallback(async () => {
    if (submitted || !startTime || !paper) return;
    saveCurrentAnnotations();
    const now = Date.now();
    const times = {
      ...questionTimes,
      [currentQuestion]: (questionTimes[currentQuestion] || 0) + (questionStartRef.current ? (now - questionStartRef.current) / 1000 : 0),
    };
    const draft = { selectedAnswers, flaggedQuestions, currentQuestion, currentPage, config, timeRemaining, elapsed, questionTimes: times, annotations: annotationsMapRef.current };
    try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* A signed-in user still has a cloud draft attempt. */ }
    if (!isAuthenticated || paperId.startsWith('guest-')) return;
    try {
      const response = await attemptsAPI.saveDraft({
        id: cloudDraftIdRef.current || undefined,
        paperId,
        source: isLibraryPaper ? 'library' : 'upload',
        mode: config.mode,
        draft: { selectedAnswers, flaggedQuestions, currentQuestion, currentPage, config, timeRemaining, elapsed, questionTimes: times },
        annotations: annotationsMapRef.current,
      });
      if (response.data.attempt?.id) setCloudDraftId(response.data.attempt.id);
    } catch {
      // The on-device draft remains available if the network is interrupted.
    }
  }, [config, currentPage, currentQuestion, draftKey, elapsed, flaggedQuestions, isAuthenticated, isLibraryPaper, paper, paperId, questionTimes, saveCurrentAnnotations, selectedAnswers, startTime, submitted, timeRemaining]);

  const handleSubmit = useCallback(async () => {
    if (submitted || submissionRef.current || !startTime) return;
    submissionRef.current = true;

    setSubmitted(true);
    setIsRunning(false);
    removeOngoingTest(ongoingPath, accountKey(user));
    try { localStorage.removeItem(draftKey); } catch { /* Results remain available in memory. */ }
    saveCurrentAnnotations();
    setRevealedAnswers(makeRevealed(totalQuestions));

    const result = scoreAttempt();
    setLocalResult(result);
    setReportOpen(true);

    if (!isAuthenticated) {
      try {
        saveLocalAttempt(user, { ...result, id: `local-${crypto.randomUUID()}`, paper: { id: paperId, title: paper?.title, subject: paper?.subject, year: paper?.year }, mode: config.mode, completedAt: new Date().toISOString(), totalTimeTaken: startTime ? Math.round((Date.now() - startTime) / 1000) : 0 });
        toast.success('Result saved on this device. Your progress is up to date.');
      } catch { toast.error('Your score is shown, but this device could not save it.'); }
      return;
    }

    if (isLibraryPaper) {
      try {
        saveLocalAttempt(user, { ...result, id: `local-${crypto.randomUUID()}`, paper: { id: paperId, title: paper?.title, subject: paper?.subject, year: paper?.year }, mode: config.mode, completedAt: new Date().toISOString(), totalTimeTaken: startTime ? Math.round((Date.now() - startTime) / 1000) : 0 });
      } catch { /* Cloud saving remains available even if browser storage is blocked. */ }
    }

    try {
      const answersPayload = {};
      for (let q = 1; q <= totalQuestions; q += 1) {
        answersPayload[q] = selectedAnswers[q] || null;
        answersPayload[`${q}_time`] = result.answers[q].timeSpent;
      }

      const totalTime = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      await attemptsAPI.submit({
        paperId,
        source: isLibraryPaper ? 'library' : 'upload',
        draftAttemptId: cloudDraftIdRef.current || undefined,
        mode: config.mode,
        answers: answersPayload,
        totalTimeTaken: totalTime,
        examDuration: config.customTime * 60,
        annotations: annotationsMapRef.current,
      });
      toast.success('Report saved to your account.');
    } catch {
      toast.error('Failed to save results. Your score is still shown here.');
    }
  }, [
    config.customTime,
    config.mode,
    isAuthenticated,
    isLibraryPaper,
    ongoingPath,
    paperId,
    saveCurrentAnnotations,
    scoreAttempt,
    selectedAnswers,
    startTime,
    submitted,
    toast,
    totalQuestions,
    draftKey,
    paper,
    user,
  ]);

  useEffect(() => {
    const loadPaper = async () => {
      try {
        clearQuestionPaper();
        libraryDetailsLoadedRef.current = false;
        libraryDetailsRequestRef.current = null;
        setLayoutMode('full');
        setCropData(null);
        setCropError('');

        let draft = readSaved(draftKey, null);
        // A new session has everything it needs locally. Do not hold its start dialog
        // behind a round trip for a draft that usually does not exist.
        if (draft && isAuthenticated && !paperId.startsWith('guest-')) {
          try {
            const cloud = await attemptsAPI.getDraft(paperId, isLibraryPaper ? 'library' : 'upload');
            if (cloud.data.attempt) {
              const remoteAttempt = cloud.data.attempt;
              draft = { ...draft, ...(remoteAttempt.draft || {}) };
              annotationsMapRef.current = remoteAttempt.annotations || {};
              setCloudDraftId(remoteAttempt.id);
            }
          } catch {
            // The browser draft is still a usable offline fallback.
          }
        }
        const savedConfig = draft?.config || {};
        const mergedConfig = {
          mode: savedConfig.mode || 'casual',
          customTime: savedConfig.customTime || 75,
          showInstantFeedback: savedConfig.showInstantFeedback ?? true,
        };
        setConfig(mergedConfig);
        if (mergedConfig.mode === 'exam') setTimeRemaining(draft?.timeRemaining ?? mergedConfig.customTime * 60);
        if (draft) {
          annotationsMapRef.current = draft.annotations || annotationsMapRef.current;
          setSelectedAnswers(draft.selectedAnswers || {});
          setFlaggedQuestions(draft.flaggedQuestions || {});
          setCurrentQuestion(draft.currentQuestion || 1);
          setCurrentPage(draft.currentPage || 1);
          setQuestionTimes(draft.questionTimes || {});
          setElapsed(draft.elapsed || 0);
          if (mergedConfig.mode === 'casual') setRevealedAnswers(Object.fromEntries(Object.keys(draft.selectedAnswers || {}).map((q) => [q, true])));
        }

        if (paperId.startsWith('guest-')) {
          const guestDataStr = sessionStorage.getItem('guestPaperData');
          if (!guestDataStr) throw new Error('Guest data not found');
          const guestData = JSON.parse(guestDataStr);
          setPaper({ title: guestData.title, isGuest: true, subject: 'Guest Paper', totalQuestions: 40 });
          setCorrectAnswers({});
          setPdfUrl(guestData.questionPaperBlob);
          pdfObjectUrlRef.current = null;
          pdfUrlRef.current = guestData.questionPaperBlob;
        } else if (isLibraryPaper) {
          const previewPaper = location.state?.paper;
          if (previewPaper?.id === paperId) {
            setPaper({ ...previewPaper, isLibrary: true });
            setDiscountedQuestions(previewPaper.discountedQuestions || []);
          } else {
            await loadLibraryDetails();
          }
        } else {
          const paperRes = await papersAPI.getOne(paperId);
          setPaper(paperRes.data.paper);
          setCorrectAnswers(paperRes.data.paper.answers || {});
        }

        if (draft) {
          if (isLibraryPaper) await loadLibraryDetails();
          if (!paperId.startsWith('guest-')) await loadQuestionPaper();
          const now = Date.now();
          questionStartRef.current = now;
          setStartTime(now - (draft.elapsed || 0) * 1000);
          deadlineRef.current = now + (draft.timeRemaining ?? mergedConfig.customTime * 60) * 1000;
          setIsRunning(true);
        } else setSetupOpen(true);
      } catch (error) {
        const message = error.response?.status === 503
          ? 'Paper service is reconnecting to the database. Try again in a moment.'
          : 'Failed to load paper';
        toast.error(message);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadPaper();
  }, [clearQuestionPaper, draftKey, isAuthenticated, isLibraryPaper, loadLibraryDetails, loadQuestionPaper, location.state, navigate, paperId, toast]);

  useEffect(() => {
    if (!isRunning || submitted || !startTime) return undefined;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
      if (config.mode === 'exam') {
        const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
        setTimeRemaining(remaining);
        if (!remaining) void handleSubmit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [config.mode, handleSubmit, isRunning, submitted, startTime]);

  useEffect(() => {
    if (submitted || !startTime) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [submitted, startTime]);

  useEffect(() => {
    if (!paper || submitted || loading || !startTime) return;

    try {
      const saved = readSaved(ONGOING_TESTS_KEY, []);
      const otherTests = Array.isArray(saved) ? saved.filter((test) => test.path !== ongoingPath || test.owner !== accountKey(user)) : [];
      localStorage.setItem(ONGOING_TESTS_KEY, JSON.stringify([{
        title: paper.title || 'Untitled paper',
        subject: paper.subject || paper.paperType || 'Paper 1',
        mode: config.mode || 'casual',
        path: ongoingPath,
        startedAt: startTime || Date.now(),
        owner: accountKey(user),
        answered: answeredCount,
      }, ...otherTests].slice(0, 20)));
      saveCurrentAnnotations();
      const times = { ...questionTimes, [currentQuestion]: (questionTimes[currentQuestion] || 0) + (questionStartRef.current ? (Date.now() - questionStartRef.current) / 1000 : 0) };
      localStorage.setItem(draftKey, JSON.stringify({ selectedAnswers, flaggedQuestions, currentQuestion, currentPage, config, timeRemaining, elapsed, questionTimes: times, annotations: annotationsMapRef.current }));
    } catch {
      // Ongoing tests are a dashboard convenience only.
    }
  }, [answeredCount, config, currentPage, currentQuestion, draftKey, flaggedQuestions, loading, ongoingPath, paper, saveCurrentAnnotations, selectedAnswers, startTime, submitted, timeRemaining, user, elapsed, questionTimes]);

  useEffect(() => {
    if (!isAuthenticated || paperId.startsWith('guest-') || submitted || loading || !paper || !startTime) return undefined;
    if (cloudSaveTimerRef.current) window.clearTimeout(cloudSaveTimerRef.current);
    cloudSaveTimerRef.current = window.setTimeout(() => {
      saveCurrentAnnotations();
      void attemptsAPI.saveDraft({
        id: cloudDraftIdRef.current || undefined,
        paperId,
        source: isLibraryPaper ? 'library' : 'upload',
        mode: config.mode,
        draft: { selectedAnswers, flaggedQuestions, currentQuestion, currentPage, config, timeRemaining, elapsed, questionTimes },
        annotations: annotationsMapRef.current,
      }).then((response) => {
        if (response.data.attempt?.id) setCloudDraftId(response.data.attempt.id);
      }).catch(() => {
        // Local storage remains available if the network is interrupted.
      });
    }, 900);
    return () => {
      if (cloudSaveTimerRef.current) window.clearTimeout(cloudSaveTimerRef.current);
    };
  }, [cloudDraftId, config, currentPage, currentQuestion, elapsed, flaggedQuestions, isAuthenticated, isLibraryPaper, loading, paper, paperId, questionTimes, saveCurrentAnnotations, selectedAnswers, startTime, submitted, timeRemaining]);

  useEffect(() => {
    if (!canvasHostRef.current || fabricRef.current) return undefined;

    let disposed = false;
    const host = canvasHostRef.current;
    const canvasElement = document.createElement('canvas');
    canvasElement.className = 'drawing-canvas';
    host.replaceChildren(canvasElement);
    canvasRef.current = canvasElement;

    const initFabric = async () => {
      const fabric = await import('fabric');
      if (disposed || !canvasRef.current) return;
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: false,
        selection: true,
        backgroundColor: 'transparent',
      });
      fabricRef.current = canvas;
      setCanvasReady((value) => value + 1);
      updateCanvasSize();
      loadAnnotations(currentCanvasKeyRef.current);
    };

    initFabric();

    return () => {
      disposed = true;
      if (fabricRef.current) {
        disposeFabricCanvas();
      }
    };
  }, [currentCanvasKey, disposeFabricCanvas, loadAnnotations, pdfUrl, updateCanvasSize]);

  useEffect(() => {
    const stage = annotationStageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      if (resizeFrameRef.current) cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        updateCanvasSize();
      });
    });
    observer.observe(stage);
    updateCanvasSize();
    return () => {
      observer.disconnect();
      if (resizeFrameRef.current) cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    };
  }, [activeCrop, layoutMode, pdfUrl, updateCanvasSize]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const updateTool = async () => {
      const fabric = await import('fabric');
      if (activeTool === 'draw' || activeTool === 'highlighter') {
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = activeTool === 'highlighter' ? `${brushColor}55` : brushColor;
        canvas.freeDrawingBrush.width = activeTool === 'highlighter' ? brushSize * 4 : brushSize;
      } else if (activeTool === 'eraser') {
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
      } else {
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
      }
    };

    updateTool();
  }, [activeTool, brushColor, brushSize, canvasReady]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return undefined;
    const record = () => recordAnnotationHistory();
    const syncControls = () => syncHistoryControls();
    const eraseTarget = (event) => {
      if (activeTool !== 'eraser' || !event.target) return;
      canvas.remove(event.target);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      recordAnnotationHistory();
    };
    canvas.on('path:created', record);
    canvas.on('object:modified', record);
    canvas.on('selection:created', syncControls);
    canvas.on('selection:updated', syncControls);
    canvas.on('selection:cleared', syncControls);
    canvas.on('mouse:down', eraseTarget);
    return () => {
      canvas.off('path:created', record);
      canvas.off('object:modified', record);
      canvas.off('selection:created', syncControls);
      canvas.off('selection:updated', syncControls);
      canvas.off('selection:cleared', syncControls);
      canvas.off('mouse:down', eraseTarget);
    };
  }, [activeTool, canvasReady, recordAnnotationHistory, syncHistoryControls]);

  useLayoutEffect(() => {
    scaleRef.current = scale;
    targetScaleRef.current = scale;
    const scroll = scrollRef.current;
    const anchor = zoomAnchorRef.current;
    if (scroll && anchor) {
      scroll.scrollLeft = anchor.worldX * scale - anchor.x;
      scroll.scrollTop = anchor.worldY * scale - anchor.y;
      zoomAnchorRef.current = null;
    }
  }, [scale, updateCanvasSize]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return undefined;
    const wheel = (event) => {
      const isZoomGesture = event.ctrlKey || event.metaKey;
      if (!isZoomGesture) return;

      event.preventDefault();
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientHeight : 1;
      wheelDeltaRef.current += event.deltaY * multiplier;
      wheelPointRef.current = { clientX: event.clientX, clientY: event.clientY };

      if (wheelFrameRef.current) return;
      wheelFrameRef.current = requestAnimationFrame(() => {
        const delta = Math.max(-180, Math.min(180, wheelDeltaRef.current));
        wheelDeltaRef.current = 0;
        wheelFrameRef.current = null;
        const factor = Math.exp(-delta * 0.00115);
        setZoomFromPoint((targetScaleRef.current || scaleRef.current) * factor, wheelPointRef.current);
      });
    };
    scroll.addEventListener('wheel', wheel, { passive: false });
    return () => {
      scroll.removeEventListener('wheel', wheel);
      if (wheelFrameRef.current) cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
      wheelDeltaRef.current = 0;
    };
  }, [loading, setZoomFromPoint]);

  useEffect(() => {
    const handleMove = (event) => {
      if (!resizeStartRef.current) return;
      const delta = resizeStartRef.current.startX - event.clientX;
      const nextWidth = Math.min(560, Math.max(280, resizeStartRef.current.startWidth + delta));
      setAnswerPanelWidth(nextWidth);
    };

    const handleUp = () => {
      resizeStartRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, []);

  const ensureCropData = useCallback(async () => {
    if (paperId.startsWith('guest-')) {
      setCropError('Focused questions are available after you save a paper.');
      return null;
    }
    if (cropData) return cropData;
    if (cropRequestRef.current?.paperId === paperId) return cropRequestRef.current.promise;

    setCropLoading(true);
    setCropError('');
    const request = (isLibraryPaper
      ? libraryAPI.getCrops(paperId)
      : papersAPI.getCrops(paperId))
      .then((res) => {
        if (cropRequestRef.current?.promise === request) setCropData(res.data);
        return res.data;
      })
      .catch(() => {
        if (cropRequestRef.current?.promise === request) {
          setCropError('Could not prepare cropped questions.');
          toast.error('Could not prepare cropped questions');
        }
        return null;
      })
      .finally(() => {
        if (cropRequestRef.current?.promise === request) {
          cropRequestRef.current = null;
          setCropLoading(false);
        }
      });
    cropRequestRef.current = { paperId, promise: request };
    return request;
  }, [cropData, isLibraryPaper, paperId, toast]);

  const handleLayoutModeChange = async (nextMode) => {
    if (nextMode === layoutMode) return;
    const cropRequest = nextMode === 'crop' ? ensureCropData() : null;
    saveCurrentAnnotations();
    disposeFabricCanvas();
    setLayoutMode(nextMode);
    if (cropRequest) await cropRequest;
  };

  useEffect(() => {
    if (!pdfUrl || layoutMode !== 'crop') return;
    const timer = window.setTimeout(() => {
      void ensureCropData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ensureCropData, layoutMode, pdfUrl]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > numPages) return;
    saveCurrentAnnotations();
    disposeFabricCanvas();
    setCurrentPage(newPage);
  };

  const handleQuestionFocus = (q) => {
    if (q < 1 || q > totalQuestions || currentQuestion === q) return;

    const now = new Date().getTime();
    if (questionStartRef.current && !submitted) {
      setQuestionTimes((prev) => ({
        ...prev,
        [currentQuestion]: (prev[currentQuestion] || 0) + (now - questionStartRef.current) / 1000,
      }));
      questionStartRef.current = now;
    }

    if (layoutMode === 'crop') {
      saveCurrentAnnotations();
      disposeFabricCanvas();
    }
    setCurrentQuestion(q);
  };

  const addShape = async (type) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const fabric = await import('fabric');
    const scroll = scrollRef.current;
    const center = { x: ((scroll?.scrollLeft || 0) + (scroll?.clientWidth || canvas.width) / 2) / scale, y: ((scroll?.scrollTop || 0) + (scroll?.clientHeight || canvas.height) / 2) / scale };
    let shape;

    if (type === 'rect') {
      shape = new fabric.Rect({
        left: center.x - 50,
        top: center.y - 30,
        width: 100,
        height: 60,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: 2,
      });
    } else if (type === 'circle') {
      shape = new fabric.Ellipse({
        left: center.x - 40,
        top: center.y - 40,
        rx: 40,
        ry: 40,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: 2,
      });
    } else if (type === 'line') {
      shape = new fabric.Line([center.x - 60, center.y, center.x + 60, center.y], {
        stroke: brushColor,
        strokeWidth: 2,
      });
    } else if (type === 'text') {
      shape = new fabric.IText('Type here', {
        left: center.x - 40,
        top: center.y - 10,
        fontSize: 16,
        fill: brushColor,
        fontFamily: 'Manrope',
      });
    }

    if (!shape) return;
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
    recordAnnotationHistory();
    setActiveTool('select');
  };

  const handleClearCanvas = () => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.renderAll();
    recordAnnotationHistory();
    setClearConfirmOpen(false);
  };

  const handleDeleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
    recordAnnotationHistory();
  };

  const requestExit = () => {
    if (submitted || !startTime) {
      navigate('/dashboard');
      return;
    }
    setLeaveConfirmOpen(true);
  };

  const leaveSolver = async () => {
    await saveDraftNow();
    toast.success('Your draft is saved. You can resume it from your desk.');
    navigate('/dashboard');
  };

  const requestSubmit = () => {
    if (!submitted && startTime) setSubmitConfirmOpen(true);
  };

  const handleSelectAnswer = (q, answer) => {
    if (submitted || !startTime || discountedSet.has(q)) return;

    handleQuestionFocus(q);
    setSelectedAnswers((prev) => ({ ...prev, [q]: answer }));
    if (config.mode === 'casual' && config.showInstantFeedback) {
      setRevealedAnswers((prev) => ({ ...prev, [q]: true }));
    }
  };

  const toggleFlag = (q) => {
    setFlaggedQuestions((prev) => ({ ...prev, [q]: !prev[q] }));
  };

  const getAnswerStatus = (q) => {
    if (discountedSet.has(q)) return 'discounted';
    if (!selectedAnswers[q]) return 'unanswered';
    if (!correctAnswers[q]) return revealedAnswers[q] ? 'ungraded' : 'selected';
    if (!revealedAnswers[q]) return 'selected';
    return selectedAnswers[q] === correctAnswers[q] ? 'correct' : 'wrong';
  };

  const visibleQuestions = Array.from({ length: totalQuestions }, (_, index) => index + 1).filter((q) => {
    if (reviewFilter === 'flagged') return flaggedQuestions[q];
    if (reviewFilter === 'unanswered') return !discountedSet.has(q) && !selectedAnswers[q];
    return true;
  });

  const zoomIn = () => setZoomFromPoint((targetScaleRef.current || scaleRef.current) * 1.12);
  const zoomOut = () => setZoomFromPoint((targetScaleRef.current || scaleRef.current) / 1.12);
  const resetZoom = () => setZoomFromPoint(1);

  const beginPaper = async (event) => {
    event.preventDefault();
    const minutes = Number(config.customTime);
    if (config.mode === 'exam' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 360)) return;

    try {
      await Promise.all([
        loadQuestionPaper(),
        loadLibraryDetails(),
      ]);
    } catch {
      return;
    }

    const now = Date.now();
    questionStartRef.current = now;
    deadlineRef.current = now + minutes * 60000;
    setTimeRemaining(minutes * 60);
    setStartTime(now);
    setIsRunning(true);
    setSetupOpen(false);
  };

  if (loading) {
    return (
      <div className="solver-loading">
        <div className="spinner spinner-lg" />
        <p className="text-secondary">Loading paper...</p>
      </div>
    );
  }

  return (
    <main
      className="solver-page"
      style={{ '--answer-panel-width': `${answerPanelWidth}px`, '--paper-scale': scale }}
    >
      <header className="solver-commandbar">
        <button className="solver-back" onClick={requestExit} aria-label="Back to dashboard">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="solver-paper-title">
          <span>
            <BookOpen size={15} aria-hidden="true" />
            {paper?.subject || paper?.paperType || 'Paper'}
          </span>
          <h1>{paper?.title || 'Paper'}</h1>
        </div>
        <div className={`solver-timer centered-timer ${config.mode === 'exam' && timeRemaining < 600 ? 'is-warning' : ''}`} role="timer" aria-label={config.mode === 'exam' ? 'Time remaining' : 'Time elapsed'}>
          <Clock3 size={18} aria-hidden="true" /><div><small>{submitted ? 'COMPLETED' : config.mode === 'exam' ? 'TIME REMAINING' : 'TIME ELAPSED'}</small><b>{formatDuration(submitted ? localResult?.totalTimeTaken : config.mode === 'exam' ? timeRemaining : elapsed)}</b></div>
        </div>
        <div className="layout-switch" aria-label="Question view">
          <button
            type="button"
            className={layoutMode === 'crop' ? 'is-active' : ''}
            onClick={() => handleLayoutModeChange('crop')}
            disabled={paperId.startsWith('guest-') || cropLoading}
          >
            <ScanLine size={15} aria-hidden="true" /> Cropped
          </button>
          <button
            type="button"
            className={layoutMode === 'full' ? 'is-active' : ''}
            onClick={() => handleLayoutModeChange('full')}
          >
            <FileText size={15} aria-hidden="true" /> Full
          </button>
        </div>
        <div className="solver-progress">
          <span className="answer-progress">
            {answeredCount}/{totalQuestions - discountedSet.size} answered
          </span>
          <button className="btn btn-primary btn-sm" onClick={submitted ? () => setReportOpen(true) : requestSubmit} disabled={!startTime}>
            <Send size={15} aria-hidden="true" /> {submitted ? 'View report' : config.mode === 'exam' ? 'Finish exam' : 'Submit'}
          </button>
        </div>
      </header>

      <section className="solver-workspace">
        <section className="paper-workbench" aria-label="Question paper">
          <DrawingToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            brushColor={brushColor}
            setBrushColor={setBrushColor}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            onAddShape={addShape}
            onClear={() => setClearConfirmOpen(true)}
            onDelete={handleDeleteSelected}
            onUndo={() => void restoreHistory(-1)}
            onRedo={() => void restoreHistory(1)}
            canUndo={historyControls.canUndo}
            canRedo={historyControls.canRedo}
            canDelete={historyControls.canDelete}
            hasAnnotations={historyControls.hasAnnotations}
          />
          <div className="paper-scroll" ref={scrollRef}>
            <div
              className="paper-zoom-shell"
              style={stageSize.width && stageSize.height ? {
                width: `${Math.ceil(stageSize.width * scale)}px`,
                height: `${Math.ceil(stageSize.height * scale)}px`,
              } : undefined}
            >
            <div
              className={`paper-zoom-surface ${layoutMode === 'crop' ? 'crop-canvas-wrapper' : 'pdf-canvas-wrapper'}`}
              ref={zoomSurfaceRef}
            >
              <div className="annotation-stage" ref={annotationStageRef}>
              {layoutMode === 'full' && pdfUrl && (
                <Suspense fallback={<div className="pdf-loading"><div className="spinner" /></div>}>
                  <PdfPaperPage
                    file={pdfUrl}
                    pageNumber={currentPage}
                    onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
                    onRenderSuccess={() => window.setTimeout(updateCanvasSize, 50)}
                  />
                </Suspense>
              )}
              {layoutMode === 'crop' && (
                <>
                  {cropLoading && (
                    <div className="crop-state crop-state-loading" role="status" aria-live="polite">
                      <div className="spinner" />
                      <b>Creating focused question views</b>
                      <span>Finding question boundaries in this paper. This can take a minute the first time.</span>
                      <div className="crop-progress" aria-hidden="true"><i /></div>
                    </div>
                  )}
                  {!cropLoading && cropError && (
                    <div className="crop-state">
                      <b>{cropError}</b>
                    </div>
                  )}
                  {!cropLoading && !cropError && activeCrop && (
                    <>
                      <img
                        className="crop-question-image"
                        src={isLibraryPaper
                          ? libraryAPI.getCropImageUrl(paperId, currentQuestion)
                          : papersAPI.getCropImageUrl(paperId, currentQuestion)}
                        alt={`${paper?.title || 'Paper'} question ${currentQuestion}`}
                        style={{ width: '900px' }}
                        onLoad={() => window.setTimeout(updateCanvasSize, 50)}
                      />
                    </>
                  )}
                  {!cropLoading && !cropError && cropData && !activeCrop && (
                    <div className="crop-state">
                      <b>This question could not be focused from the paper.</b>
                    </div>
                  )}
                </>
              )}
              <div
                ref={canvasHostRef}
                className={`annotation-canvas-host ${layoutMode === 'crop' && !activeCrop ? 'is-hidden' : ''}`}
                aria-hidden="true"
              />
              </div>
            </div>
            </div>
          </div>
          <footer className="paper-controls">
            {layoutMode === 'full' ? (
              <div className="page-controls">
                <button className="icon-control" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page">
                  <ArrowLeft size={17} aria-hidden="true" />
                </button>
                <label className="page-field">
                  <span>Page</span>
                  <input
                    type="number"
                    value={currentPage}
                    min={1}
                    max={numPages}
                    onChange={(event) => handlePageChange(parseInt(event.target.value, 10) || 1)}
                  />
                  <small>/ {numPages}</small>
                </label>
                <button className="icon-control" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= numPages} aria-label="Next page">
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="page-controls">
                <button className="icon-control" onClick={() => handleQuestionFocus(currentQuestion - 1)} disabled={currentQuestion <= 1} aria-label="Previous question">
                  <ArrowLeft size={17} aria-hidden="true" />
                </button>
                <label className="page-field">
                  <span>Question</span>
                  <input
                    type="number"
                    value={currentQuestion}
                    min={1}
                    max={totalQuestions}
                    onChange={(event) => handleQuestionFocus(parseInt(event.target.value, 10) || 1)}
                  />
                  <small>/ {totalQuestions}</small>
                </label>
                <button className="icon-control" onClick={() => handleQuestionFocus(currentQuestion + 1)} disabled={currentQuestion >= totalQuestions} aria-label="Next question">
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="zoom-strip" aria-label="Paper zoom controls">
              <button className="icon-control" onClick={zoomOut} aria-label="Zoom out">
                <Minimize2 size={16} aria-hidden="true" />
              </button>
              <input
                type="range"
                min="0.55"
                max="2.4"
                step="0.05"
                value={scale}
                onChange={(event) => setZoomFromPoint(Number(event.target.value))}
                aria-label="Paper zoom"
              />
              <button className="zoom-value" onClick={resetZoom}>
                {Math.round(scale * 100)}%
              </button>
              <button className="icon-control" onClick={zoomIn} aria-label="Zoom in">
                <Maximize2 size={16} aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>

        <div
          className="answer-resizer"
          role="separator"
          aria-label="Resize answer panel"
          aria-orientation="vertical"
          onPointerDown={(event) => {
            resizeStartRef.current = { startX: event.clientX, startWidth: answerPanelWidth };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
        >
          <Columns3 size={15} aria-hidden="true" />
        </div>

        <aside className="answer-panel" aria-label="Answer sheet">
          <div className="answer-panel-head">
            <div>
              <span className="small-label">Answer sheet</span>
              <h2>Questions</h2>
            </div>
            <span className="flag-count">
              <Flag size={14} aria-hidden="true" /> {flaggedCount}
            </span>
          </div>

          {localResult && (
            <div className="solver-result">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <b>{localResult.percentage === null ? 'Unmarked' : `${localResult.percentage}%`}</b>
                <span>{localResult.totalCorrect}/{localResult.gradeableTotal} correct</span>
              </div>
            </div>
          )}

          <div className="review-tabs" aria-label="Question filters">
            {[
              ['all', 'All', totalQuestions],
              ['unanswered', 'Open', unansweredCount],
              ['flagged', 'Flagged', flaggedCount],
            ].map(([value, label, count]) => (
              <button
                key={value}
                className={reviewFilter === value ? 'is-active' : ''}
                onClick={() => setReviewFilter(value)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>

          <div className="answer-list">
            {visibleQuestions.map((q) => {
              const status = getAnswerStatus(q);
              return (
                <article
                  className={`answer-row ${status} ${currentQuestion === q ? 'is-current' : ''}`}
                  key={q}
                >
                  <button
                    className={`flag-button ${flaggedQuestions[q] ? 'is-flagged' : ''}`}
                    onClick={() => toggleFlag(q)}
                    aria-label={`${flaggedQuestions[q] ? 'Unflag' : 'Flag'} question ${q}`}
                  >
                    <Flag size={14} aria-hidden="true" />
                  </button>
                  <button className="question-number" onClick={() => handleQuestionFocus(q)}>
                    {q}
                  </button>
                  {status === 'discounted' ? (
                    <span className="discounted-note">Discounted</span>
                  ) : (
                    <div className="answer-options">
                      {OPTIONS.map((option) => {
                        let className = 'answer-option';
                        if (selectedAnswers[q] === option) className += ' selected';
                        if (revealedAnswers[q] && correctAnswers[q] && option === correctAnswers[q]) className += ' correct';
                        if (revealedAnswers[q] && correctAnswers[q] && selectedAnswers[q] === option && option !== correctAnswers[q]) {
                          className += ' wrong';
                        }

                        const isSelected = selectedAnswers[q] === option;
                        const isCorrect = revealedAnswers[q] && correctAnswers[q] && option === correctAnswers[q];
                        const isWrong = revealedAnswers[q] && correctAnswers[q] && isSelected && option !== correctAnswers[q];
                        const outcome = isWrong ? ', selected and incorrect' : isCorrect ? ', correct answer' : isSelected ? ', selected' : '';
                        return (
                          <button
                            key={option}
                            className={className}
                            onClick={() => handleSelectAnswer(q, option)}
                            disabled={submitted}
                            aria-label={`Question ${q}, answer ${option}${outcome}`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {revealedAnswers[q] && correctAnswers[q] && (
                    <p className="answer-feedback" role="status">
                      {selectedAnswers[q] === correctAnswers[q]
                        ? 'Correct.'
                        : `Incorrect. The correct answer is ${correctAnswers[q]}.`}
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <footer className="answer-panel-foot">
              <button className="btn btn-primary" onClick={submitted ? () => setReportOpen(true) : requestSubmit} disabled={!startTime}>
                {submitted ? 'View report' : config.mode === 'exam' ? 'Finish exam' : 'Submit paper'}
            </button>
          </footer>
        </aside>
      </section>

      {setupOpen && <StudioDialog title="Start paper" onClose={() => navigate(isLibraryPaper ? '/library' : '/dashboard')} className="paper-setup">
        <span className="small-label">BEFORE YOU BEGIN</span><h2>Make this session yours.</h2><p>{paper?.title}</p>
        <form onSubmit={beginPaper}>
          <fieldset className="setup-modes"><legend>Session mode</legend>
            <label><input type="radio" name="mode" value="casual" checked={config.mode === 'casual'} onChange={() => setConfig((value) => ({ ...value, mode: 'casual', showInstantFeedback: true }))} /><span><b>Casual practice</b><small>At your pace, with instant answer feedback.</small></span></label>
            <label><input type="radio" name="mode" value="exam" checked={config.mode === 'exam'} onChange={() => setConfig((value) => ({ ...value, mode: 'exam', showInstantFeedback: false }))} /><span><b>Timed exam</b><small>A countdown, with answers revealed at the end.</small></span></label>
          </fieldset>
          {config.mode === 'exam' && <label className="setup-duration">Exam duration <span><input type="number" min="1" max="360" step="1" required value={config.customTime} onChange={(event) => setConfig((value) => ({ ...value, customTime: event.target.value }))} /> minutes</span><small>1 to 360 minutes</small></label>}
          {pdfError && <p className="setup-load-error" role="alert">{pdfError}</p>}
          <button type="submit" className="btn btn-primary" disabled={pdfLoading}>
            {pdfLoading ? 'Loading paper…' : config.mode === 'exam' ? 'Start exam' : 'Start practice'}
            {!pdfLoading && <ArrowRight size={17} />}
          </button>
        </form>
      </StudioDialog>}
      {submitConfirmOpen && <StudioDialog title="Submit paper" onClose={() => setSubmitConfirmOpen(false)} className="paper-setup">
        <span className="small-label">FINAL CHECK</span>
        <h2>{config.mode === 'exam' ? 'Ready to finish your exam?' : 'Ready to submit this paper?'}</h2>
        <p>{answeredCount} answered · {unansweredCount} unanswered{flaggedCount ? ` · ${flaggedCount} flagged` : ''}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setSubmitConfirmOpen(false)}>Keep working</button>
          <button type="button" className="btn btn-primary" onClick={() => { setSubmitConfirmOpen(false); void handleSubmit(); }}>Submit paper</button>
        </div>
      </StudioDialog>}
      {leaveConfirmOpen && <StudioDialog title="Leave paper" onClose={() => setLeaveConfirmOpen(false)} className="paper-setup">
        <span className="small-label">SAVE YOUR PROGRESS</span>
        <h2>Leave this paper for now?</h2>
        <p>Your answers, flags, timer, and annotations will be saved on this device{isAuthenticated ? ' and to your account' : ''}.</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setLeaveConfirmOpen(false)}>Keep working</button>
          <button type="button" className="btn btn-primary" onClick={() => { void leaveSolver(); }}>Save and leave</button>
        </div>
      </StudioDialog>}
      {clearConfirmOpen && <StudioDialog title="Clear annotations" onClose={() => setClearConfirmOpen(false)} className="paper-setup">
        <span className="small-label">ANNOTATIONS</span>
        <h2>Clear every annotation on this view?</h2>
        <p>This removes the ink and objects for the current {layoutMode === 'crop' ? 'question' : 'page'}. You can undo it afterwards.</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setClearConfirmOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleClearCanvas}>Clear annotations</button>
        </div>
      </StudioDialog>}
      {reportOpen && localResult && <PaperReport result={localResult} title={paper?.title} onClose={() => setReportOpen(false)} onReview={() => setReportOpen(false)} onDashboard={() => navigate('/dashboard')} />}
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2, Clock3, FilePenLine, KeyRound, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { writtenAttemptsAPI, writtenLibraryAPI } from '../../services/api';
import { prepareAnnotatedPaperImages } from '../../services/writtenAiReview';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './WrittenResultsPage.css';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const GRADE_KEYS = ['A', 'B', 'C', 'D', 'E'];

function gradeFor(score, threshold) {
  if (!Number.isFinite(score) || !threshold?.grades) return null;
  for (const grade of GRADE_KEYS) {
    if (Number.isFinite(threshold.grades[grade]) && score >= threshold.grades[grade]) return grade;
  }
  return 'U';
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(value / 60)}m ${String(value % 60).padStart(2, '0')}s`;
}

function AnnotatedPdfPage({ file, pageNumber, annotation, onPageCount, className = '' }) {
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const staticCanvasRef = useRef(null);
  const [renderVersion, setRenderVersion] = useState(0);

  useEffect(() => {
    if (!renderVersion || !stageRef.current || !hostRef.current) return undefined;
    let cancelled = false;
    let canvas;
    const element = document.createElement('canvas');
    hostRef.current.replaceChildren(element);
    (async () => {
      const fabric = await import('fabric');
      if (cancelled || !stageRef.current) return;
      canvas = new fabric.StaticCanvas(element, { backgroundColor: 'transparent' });
      staticCanvasRef.current = canvas;
      canvas.setDimensions({ width: stageRef.current.clientWidth, height: stageRef.current.clientHeight });
      if (annotation) await canvas.loadFromJSON(annotation);
      if (!cancelled) canvas.renderAll();
    })();
    return () => {
      cancelled = true;
      canvas?.dispose();
      if (staticCanvasRef.current === canvas) staticCanvasRef.current = null;
    };
  }, [annotation, pageNumber, renderVersion]);

  return (
    <Document file={file} loading={<div className="written-result-loading"><div className="spinner" /></div>} onLoadSuccess={({ numPages }) => onPageCount(numPages)}>
      <div className={`written-result-page-stage ${className}`} ref={stageRef}>
        <Page pageNumber={pageNumber} scale={1} renderAnnotationLayer={false} renderTextLayer={false} onRenderSuccess={() => setRenderVersion((value) => value + 1)} />
        <div className="written-result-annotation" ref={hostRef} aria-hidden="true" />
      </div>
    </Document>
  );
}

export default function WrittenResultsPage() {
  const { attemptId } = useParams();
  const toast = useToast();
  const [attempt, setAttempt] = useState(null);
  const [paper, setPaper] = useState(null);
  const [questionUrl, setQuestionUrl] = useState('');
  const [markSchemeUrl, setMarkSchemeUrl] = useState('');
  const [paperPage, setPaperPage] = useState(1);
  const [schemePage, setSchemePage] = useState(1);
  const [paperPages, setPaperPages] = useState(0);
  const [schemePages, setSchemePages] = useState(0);
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [mobilePane, setMobilePane] = useState('paper');
  const [geminiKey, setGeminiKey] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [aiState, setAiState] = useState('idle');
  const [aiProgress, setAiProgress] = useState(null);
  const urlRefs = useRef([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const attemptResponse = await writtenAttemptsAPI.getOne(attemptId);
        if (!active) return;
        const loaded = attemptResponse.data.attempt;
        setAttempt(loaded);
        setPaperPage(loaded.currentPage || 1);
        setTotal(loaded.selfMark?.totalAwarded ?? '');
        setNotes(loaded.selfMark?.notes || '');
        const [paperResponse, questionResponse, markResponse] = await Promise.all([
          writtenLibraryAPI.getOne(loaded.paper.paperId),
          writtenLibraryAPI.getPDF(loaded.paper.paperId, 'question'),
          writtenLibraryAPI.getPDF(loaded.paper.paperId, 'mark-scheme'),
        ]);
        const urls = [URL.createObjectURL(questionResponse.data), URL.createObjectURL(markResponse.data)];
        urlRefs.current = urls;
        if (!active) return;
        setPaper(paperResponse.data.paper);
        setQuestionUrl(urls[0]);
        setMarkSchemeUrl(urls[1]);
      } catch (error) {
        if (active) toast.error(error.response?.data?.message || 'Your written-paper review could not be opened.');
      }
    })();
    return () => {
      active = false;
      urlRefs.current.forEach((url) => URL.revokeObjectURL(url));
      urlRefs.current = [];
    };
  }, [attemptId, toast]);

  const pageAnnotations = useMemo(() => Object.fromEntries((attempt?.pages || []).map((page) => [page.pageNumber, page.annotation])), [attempt]);
  const threshold = paper?.componentThreshold || attempt?.paper?.componentThreshold || null;
  const score = total === '' ? null : Number(total);
  const grade = gradeFor(score, threshold);
  const aiGrade = gradeFor(attempt?.aiReview?.totalAwarded, threshold);

  const saveSelfMark = async () => {
    if (total !== '' && (!Number.isFinite(score) || score < 0 || score > attempt.paper.totalMarks)) {
      toast.error(`Enter a mark from 0 to ${attempt.paper.totalMarks}.`);
      return;
    }
    setSaving(true);
    try {
      const response = await writtenAttemptsAPI.update(attemptId, { selfMark: { totalAwarded: total === '' ? null : score, notes } });
      setAttempt((current) => ({ ...current, ...response.data.attempt }));
      toast.success(total === '' ? 'Your review is saved. You can add a mark whenever you are ready.' : 'Your marks and notes are saved.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Your self-mark could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const selectForProgress = async () => {
    const hasRecordedMark = Number.isFinite(attempt.selfMark?.totalAwarded) || Number.isFinite(attempt.aiReview?.totalAwarded);
    if (!hasRecordedMark) {
      toast.error('Record a self-mark or request an AI review before selecting this version.');
      return;
    }
    setSelecting(true);
    try {
      const response = await writtenAttemptsAPI.update(attemptId, { countsTowardProgress: true });
      setAttempt((current) => ({ ...current, ...response.data.attempt }));
      toast.success('This version now counts toward your paper collection grade.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not select this version.');
    } finally {
      setSelecting(false);
    }
  };

  const requestAiReview = async () => {
    if (!geminiKey.trim()) {
      toast.error('Enter your Gemini API key to continue.');
      return;
    }
    if (!aiConsent) {
      toast.error('Confirm that you want to send this paper to Gemini first.');
      return;
    }
    setAiState('preparing');
    setAiProgress({ completed: 0, total: paperPages || 0 });
    try {
      const annotatedPages = await prepareAnnotatedPaperImages({
        questionUrl,
        pageAnnotations,
        onProgress: setAiProgress,
      });
      setAiState('reviewing');
      const response = await writtenAttemptsAPI.requestAiReview(attemptId, {
        apiKey: geminiKey.trim(),
        annotatedPages,
      });
      setAttempt((current) => ({ ...current, ...response.data.attempt }));
      setGeminiKey('');
      toast.success('AI review is ready. Compare it with the official scheme.');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'AI review could not be completed.');
    } finally {
      setAiState('idle');
      setAiProgress(null);
    }
  };

  if (!attempt || !questionUrl || !markSchemeUrl) return <div className="solver-loading"><div className="spinner spinner-lg" /><p>Preparing your review desk…</p></div>;

  return (
    <main className="written-results-page">
      <header className="written-results-header">
        <div><Link to="/written-library" className="written-results-back"><ArrowLeft size={15} /> Subjective papers</Link><span>REVIEW DESK / PAPER {attempt.paper.component}</span><h1>{attempt.paper.title}</h1></div>
        <div className="written-result-meta"><span><Clock3 size={14} /> {formatDuration(attempt.elapsedSeconds)}</span><span><FilePenLine size={14} /> {attempt.paper.totalMarks} marks</span></div>
      </header>

      <section className="written-score-card">
        <div><span className="studio-label">SELF-MARK THIS PAPER</span><h2>{grade ? `Estimated component grade: ${grade}` : 'Add your total mark'}</h2><p>Compare your annotated work with the official marking scheme, then record the total you awarded yourself.</p></div>
        <div className="written-score-input"><label>Total / {attempt.paper.totalMarks}<input type="number" min="0" max={attempt.paper.totalMarks} value={total} onChange={(event) => setTotal(event.target.value)} /></label><div className="written-score-actions"><button type="button" onClick={saveSelfMark} disabled={saving}>{saving ? 'Saving…' : <><Check size={15} /> {total === '' ? 'Save review' : 'Save mark'}</>}</button><button type="button" className="written-count-button" onClick={selectForProgress} disabled={selecting || (!Number.isFinite(attempt.selfMark?.totalAwarded) && !Number.isFinite(attempt.aiReview?.totalAwarded))}>{attempt.countsTowardProgress ? <><CheckCircle2 size={15} /> Counts toward grade</> : selecting ? 'Selecting…' : 'Use for final grade'}</button></div></div>
        <p className="written-score-status">{attempt.countsTowardProgress ? 'This is the selected version for your collection grade.' : total === '' && !Number.isFinite(attempt.aiReview?.totalAwarded) ? 'Your annotated paper is already saved. Add a mark now or return to it later from Paper Collections.' : 'If this is your only marked version, it counts automatically. With more than one version, choose the result you want to use.'}</p>
        {threshold && <div className="written-thresholds"><b>Official component thresholds</b><span>{GRADE_KEYS.map((key) => `${key} ${threshold.grades?.[key] ?? '—'}`).join(' · ')}</span></div>}
      </section>

      <section className="written-review-tabs" aria-label="Review document on mobile"><button className={mobilePane === 'paper' ? 'active' : ''} onClick={() => setMobilePane('paper')}>Your annotated paper</button><button className={mobilePane === 'scheme' ? 'active' : ''} onClick={() => setMobilePane('scheme')}>Official marking scheme</button></section>
      <section className="written-review-grid">
        <article className={`written-review-document paper ${mobilePane !== 'paper' ? 'mobile-hidden' : ''}`}>
          <header><div><span>YOUR WORK</span><h2>Annotated paper</h2></div><nav className="written-review-pagination" aria-label="Annotated-paper pages"><button type="button" onClick={() => setPaperPage((value) => Math.max(1, value - 1))} disabled={paperPage <= 1} aria-label="Previous annotated-paper page" title="Previous page"><ArrowLeft size={15} /></button><span>Page {paperPage} / {paperPages || '—'}</span><button type="button" onClick={() => setPaperPage((value) => Math.min(paperPages || 1, value + 1))} disabled={!paperPages || paperPage >= paperPages} aria-label="Next annotated-paper page" title="Next page"><ArrowRight size={15} /></button></nav><BookOpenCheck size={19} /></header>
          <div className="written-result-scroll">{questionUrl && <AnnotatedPdfPage file={questionUrl} pageNumber={paperPage} annotation={pageAnnotations[paperPage]} onPageCount={setPaperPages} />}</div>
        </article>
        <article className={`written-review-document scheme ${mobilePane !== 'scheme' ? 'mobile-hidden' : ''}`}>
          <header><div><span>OFFICIAL REFERENCE</span><h2>Marking scheme</h2></div><nav className="written-review-pagination" aria-label="Marking-scheme pages"><button type="button" onClick={() => setSchemePage((value) => Math.max(1, value - 1))} disabled={schemePage <= 1} aria-label="Previous marking-scheme page" title="Previous page"><ArrowLeft size={15} /></button><span>Page {schemePage} / {schemePages || '—'}</span><button type="button" onClick={() => setSchemePage((value) => Math.min(schemePages || 1, value + 1))} disabled={!schemePages || schemePage >= schemePages} aria-label="Next marking-scheme page" title="Next page"><ArrowRight size={15} /></button></nav><FilePenLine size={19} /></header>
          <div className="written-result-scroll">{markSchemeUrl && <AnnotatedPdfPage file={markSchemeUrl} pageNumber={schemePage} annotation={null} onPageCount={setSchemePages} className="mark-scheme" />}</div>
        </article>
      </section>

      <section className="written-review-notes"><label><b>Review notes</b><textarea value={notes} maxLength="5000" onChange={(event) => setNotes(event.target.value)} placeholder="What would you do differently next time?" /></label><aside className="written-ai-summary"><Sparkles size={18} /><b>Optional AI review</b><p>It is an estimate, not an official examiner result. Your key is used for this request only and is never saved.</p>{attempt.aiReview && <div className="written-ai-score"><span>Latest Gemini estimate</span><strong>{attempt.aiReview.totalAwarded} / {attempt.paper.totalMarks}{aiGrade ? ` · ${aiGrade}` : ''}</strong><small>{attempt.aiReview.summary}</small></div>}</aside></section>

      <section className="written-ai-review" aria-labelledby="ai-review-title">
        <div><span className="studio-label">STUDENT-KEY AI REVIEW</span><h2 id="ai-review-title">Ask Gemini Flash to compare your writing</h2><p>Your annotated question-paper pages and the official scheme are sent through our server to Gemini Flash using your own free Google AI Studio key. The key is kept in memory for this one request, then discarded.</p></div>
        <div className="written-ai-controls"><label><span><KeyRound size={14} /> Gemini API key</span><input type="password" autoComplete="off" spellCheck="false" value={geminiKey} onChange={(event) => setGeminiKey(event.target.value)} placeholder="AIza…" disabled={aiState !== 'idle'} /></label><label className="written-ai-consent"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} disabled={aiState !== 'idle'} /><span>I understand this sends my annotated paper to Google Gemini for an estimate.</span></label><button type="button" onClick={requestAiReview} disabled={aiState !== 'idle'}>{aiState === 'preparing' ? `Preparing pages ${aiProgress?.completed || 0}/${aiProgress?.total || '…'}…` : aiState === 'reviewing' ? 'Gemini is reviewing…' : <><Send size={15} /> Request AI review</>}</button><small><ShieldCheck size={13} /> No API key is stored. Google’s free tier may use submitted content to improve its products; its availability and limits are controlled by Google.</small></div>
      </section>

      {attempt.aiReview?.questions?.length > 0 && <section className="written-ai-breakdown"><header><div><span>GEMINI ESTIMATE</span><h2>Question-by-question review</h2></div><span>{attempt.aiReview.confidence} confidence overall</span></header><div>{attempt.aiReview.questions.map((item, index) => <article key={`${item.question}-${index}`}><b>{item.question}</b><strong>{item.awarded} / {item.available}</strong><p>{item.rationale || 'No rationale supplied.'}</p><small>{item.confidence} confidence</small></article>)}</div></section>}
    </main>
  );
}

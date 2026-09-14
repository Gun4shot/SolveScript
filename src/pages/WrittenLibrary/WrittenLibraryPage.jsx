import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, ChevronRight, Clock3, FilePenLine, Filter, Folder, FolderOpen, Gauge, Search, Sigma } from 'lucide-react';
import { writtenLibraryAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { accountKey, readSaved, saveSaved } from '../../components/studio/studyData';
import PaperLoadingState from '../../components/studio/PaperLoadingState';
import './WrittenLibraryPage.css';

const ALL = 'All';
const SESSION_ORDER = ['March', 'May/June', 'October/November'];
const TYPE_LABELS = {
  structured: 'Structured',
  'planning-analysis': 'Planning & analysis',
  'data-response-essay': 'Data response & essays',
  mathematics: 'Mathematics',
  'further-mathematics': 'Further mathematics',
};
const DIFFICULTY_OPTIONS = [
  [ALL, 'All difficulty'],
  ['hard', 'Harder'],
  ['balanced', 'Balanced'],
  ['accessible', 'More accessible'],
  ['unknown', 'No threshold'],
];

function difficultyLabel(value) {
  return DIFFICULTY_OPTIONS.find(([key]) => key === value)?.[1] || 'No threshold';
}

function variantOf(paper) {
  return String(paper.component || '').slice(-1);
}

function Branch({ open, children }) {
  return <div className={`written-folder-collapse ${open ? 'is-open' : ''}`} inert={!open} aria-hidden={!open}>{open && <div>{children}</div>}</div>;
}

export default function WrittenLibraryPage() {
  const { user } = useAuth();
  const viewStateKey = `solvescript:written-library-view:${accountKey(user)}`;
  const initialView = readSaved(viewStateKey, {});
  const [papers, setPapers] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedSyllabus, setSelectedSyllabus] = useState(() => initialView.selectedSyllabus || '');
  const [selectedYear, setSelectedYear] = useState(() => initialView.selectedYear ?? null);
  const [selectedSession, setSelectedSession] = useState(() => initialView.selectedSession || ALL);
  const [selectedVariant, setSelectedVariant] = useState(() => initialView.selectedVariant || ALL);
  const [selectedDifficulty, setSelectedDifficulty] = useState(() => initialView.selectedDifficulty || ALL);
  const [query, setQuery] = useState(() => initialView.query || '');
  const [filtersOpen, setFiltersOpen] = useState(() => initialView.filtersOpen ?? (typeof window === 'undefined' || window.innerWidth > 720));
  const [expandedSubject, setExpandedSubject] = useState(() => initialView.expandedSubject || '');
  const [expandedYear, setExpandedYear] = useState(() => initialView.expandedYear ?? null);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    writtenLibraryAPI.getFolders()
      .then((response) => {
        if (!active) return;
        const nextFolders = response.data.folders || [];
        setFolders(nextFolders);
        const savedView = readSaved(viewStateKey, {});
        const restoredFolder = nextFolders.find((folder) => folder.syllabusCode === savedView.selectedSyllabus) || nextFolders[0];
        const restoredYear = restoredFolder?.years.find((year) => year.year === Number(savedView.selectedYear)) || restoredFolder?.years[0];
        if (restoredFolder && restoredYear) {
          setSelectedSyllabus(restoredFolder.syllabusCode);
          setSelectedYear(restoredYear.year);
          setSelectedSession(savedView.selectedSession || ALL);
          setSelectedVariant(savedView.selectedVariant || ALL);
          setSelectedDifficulty(savedView.selectedDifficulty || ALL);
          setQuery(savedView.query || '');
          setExpandedSubject(Object.hasOwn(savedView, 'expandedSubject') ? savedView.expandedSubject : restoredFolder.syllabusCode);
          setExpandedYear(Object.hasOwn(savedView, 'expandedYear') ? savedView.expandedYear : restoredYear.year);
          setLoadingPapers(true);
        }
      })
      .catch(() => { if (active) setError('The written-paper shelf is unavailable right now.'); })
      .finally(() => { if (active) setLoadingFolders(false); });
    return () => { active = false; };
  }, [viewStateKey]);

  useEffect(() => {
    saveSaved(viewStateKey, { selectedSyllabus, selectedYear, selectedSession, selectedVariant, selectedDifficulty, query, filtersOpen, expandedSubject, expandedYear });
  }, [expandedSubject, expandedYear, filtersOpen, query, selectedDifficulty, selectedSession, selectedSyllabus, selectedVariant, selectedYear, viewStateKey]);

  useEffect(() => {
    if (!selectedSyllabus || !selectedYear) return undefined;
    let active = true;
    writtenLibraryAPI.getAll({ syllabusCode: selectedSyllabus, year: selectedYear, limit: 60 })
      .then((response) => { if (active) setPapers(response.data.papers || []); })
      .catch(() => { if (active) setError('This paper folder could not be opened.'); })
      .finally(() => { if (active) setLoadingPapers(false); });
    return () => { active = false; };
  }, [selectedSyllabus, selectedYear]);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.syllabusCode === selectedSyllabus) || null,
    [folders, selectedSyllabus],
  );
  const selectedYearFolder = useMemo(
    () => selectedFolder?.years.find((year) => year.year === selectedYear) || null,
    [selectedFolder, selectedYear],
  );
  const availableSessions = useMemo(
    () => SESSION_ORDER.filter((session) => papers.some((paper) => paper.session === session)),
    [papers],
  );
  const availableVariants = useMemo(
    () => [...new Set(papers.map(variantOf).filter(Boolean))].sort(),
    [papers],
  );
  const visiblePapers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return papers.filter((paper) => (
      (!needle || `${paper.title} ${paper.component} ${paper.session}`.toLowerCase().includes(needle))
      && (selectedSession === ALL || paper.session === selectedSession)
      && (selectedVariant === ALL || variantOf(paper) === selectedVariant)
      && (selectedDifficulty === ALL || (paper.difficulty || 'unknown') === selectedDifficulty)
    ));
  }, [papers, query, selectedDifficulty, selectedSession, selectedVariant]);
  const sessionGroups = useMemo(
    () => SESSION_ORDER.map((session) => ({ session, papers: visiblePapers.filter((paper) => paper.session === session) })).filter((group) => group.papers.length),
    [visiblePapers],
  );

  const clearSecondaryFilters = () => {
    setSelectedSession(ALL);
    setSelectedVariant(ALL);
    setSelectedDifficulty(ALL);
    setQuery('');
  };

  const chooseSubject = (syllabusCode) => {
    const folder = folders.find((item) => item.syllabusCode === syllabusCode);
    const nextYear = folder?.years[0]?.year || null;
    setPapers([]);
    setSelectedSyllabus(syllabusCode);
    setSelectedYear(nextYear);
    setExpandedSubject(syllabusCode);
    setExpandedYear(nextYear);
    setLoadingPapers(Boolean(nextYear));
    clearSecondaryFilters();
  };

  const chooseYear = (year) => {
    setPapers([]);
    setSelectedYear(year);
    setExpandedYear(year);
    setLoadingPapers(true);
    clearSecondaryFilters();
  };

  const toggleSubject = (syllabusCode) => {
    if (expandedSubject === syllabusCode) {
      setExpandedSubject('');
      setExpandedYear(null);
      return;
    }
    chooseSubject(syllabusCode);
  };

  const toggleYear = (year) => {
    if (selectedYear === year && expandedYear === year) {
      setExpandedYear(null);
      return;
    }
    chooseYear(year);
  };

  return (
    <main className="written-library-page">
      <section className="written-library-hero">
        <div className="written-library-grid" aria-hidden="true" />
        <div className="written-library-hero-copy">
          <span className="written-kicker"><FilePenLine size={15} /> SUBJECTIVE PAPER STUDIO</span>
          <h1>Take on the full paper.</h1>
          <p>Annotate real structured papers, work under a timer, then review your handwriting beside the official marking scheme.</p>
          <div className="written-library-promise"><span><Clock3 size={15} /> Official timings</span><span><FilePenLine size={15} /> Pencil-ready workspace</span><span><BookMarked size={15} /> Saved to your account</span></div>
        </div>
        <div className="written-paper-stack" aria-label="Written paper illustration"><div><i>SECTION B</i><b>Show every line of working.</b><span>01 — 06</span></div><div><i>MARKS</i><b>Method matters.</b><span>60</span></div></div>
      </section>

      <section className="written-library-content">
        <div className="written-section-heading">
          <div><span className="studio-label">THE SUBJECTIVE SHELF</span><h2>{loadingFolders ? 'Opening the shelf…' : `${folders.reduce((sum, folder) => sum + folder.count, 0)} papers ready`}</h2>{selectedFolder && selectedYear && <p className="written-browse-context">Showing {selectedFolder.subject}, {selectedYear}. Use the filters or folders to explore the full collection.</p>}</div>
          <div className="written-library-links"><Link className="written-paper-one-link" to="/written-progress">Your collections <ChevronRight size={14} /></Link><Link className="written-paper-one-link" to="/library">Looking for MCQs? <ChevronRight size={14} /></Link></div>
        </div>

        {error && <p className="studio-notice" role="alert">{error}</p>}
        {loadingFolders && <PaperLoadingState tone="dark" message="Opening the subjective-paper shelves…" />}
        {!loadingFolders && !error && folders.length === 0 && <section className="written-empty-state"><span className="written-empty-icon"><Sigma size={27} /></span><div><h3>The desk is ready. The first papers are being catalogued.</h3><p>Written papers will appear here once their question paper, marking scheme, timing and component metadata have all been verified.</p></div></section>}

        {!loadingFolders && folders.length > 0 && <>
          <details className="written-bank-filters" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
            <summary>Search and filters <Filter size={15} aria-hidden="true" /></summary>
            <div className="written-filter-controls" aria-label="Written paper filters">
            <label className="written-bank-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search paper, session or component..." aria-label="Search written papers" /></label>
            <div className="written-bank-selects"><Filter size={17} aria-hidden="true" />
              <select value={selectedSyllabus} onChange={(event) => chooseSubject(event.target.value)} aria-label="Subject">{folders.map((folder) => <option key={folder.syllabusCode} value={folder.syllabusCode}>{folder.subject}</option>)}</select>
              <select value={selectedYear || ''} onChange={(event) => chooseYear(Number(event.target.value))} aria-label="Year">{(selectedFolder?.years || []).map((year) => <option key={year.year} value={year.year}>{year.year}</option>)}</select>
              <select value={selectedSession} onChange={(event) => setSelectedSession(event.target.value)} aria-label="Session"><option value={ALL}>All sessions</option>{availableSessions.map((session) => <option key={session} value={session}>{session}</option>)}</select>
              <select value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)} aria-label="Variant"><option value={ALL}>All variants</option>{availableVariants.map((variant) => <option key={variant} value={variant}>Variant {variant}</option>)}</select>
              <select value={selectedDifficulty} onChange={(event) => setSelectedDifficulty(event.target.value)} aria-label="Difficulty">{DIFFICULTY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </div>
            </div>
          </details>

          <section className="written-library-browser">
            <aside className="written-folder-rail" aria-label="Written paper folders">
              {folders.map((folder) => <div className="written-folder-node" key={folder.syllabusCode}>
                <button type="button" className={expandedSubject === folder.syllabusCode ? 'is-active' : ''} onClick={() => toggleSubject(folder.syllabusCode)} aria-label={`${expandedSubject === folder.syllabusCode ? 'Collapse' : 'Expand'} ${folder.subject} paper folder`} aria-expanded={expandedSubject === folder.syllabusCode}><span>{expandedSubject === folder.syllabusCode ? <FolderOpen size={16} /> : <Folder size={16} />} {folder.subject}</span><small>{folder.count}</small></button>
                <Branch open={expandedSubject === folder.syllabusCode && folder.syllabusCode === selectedSyllabus}><div className="written-folder-branch">{folder.years.map((year) => <div key={year.year}><button type="button" className={expandedYear === year.year ? 'is-active' : ''} onClick={() => toggleYear(year.year)} aria-label={`${expandedYear === year.year ? 'Collapse' : 'Expand'} ${year.year} paper folder`} aria-expanded={expandedYear === year.year}><span>{expandedYear === year.year ? <FolderOpen size={15} /> : <Folder size={15} />} {year.year}</span><small>{year.count}</small></button><Branch open={expandedYear === year.year && year.year === selectedYear}><div className="written-folder-branch written-session-branch">{year.sessions.map((session) => <button type="button" key={session.code} className={selectedSession === session.label ? 'is-active' : ''} onClick={() => setSelectedSession(selectedSession === session.label ? ALL : session.label)} aria-label={`Show ${session.label} papers from ${year.year}`}><span>{selectedSession === session.label ? <FolderOpen size={14} /> : <Folder size={14} />} {session.label}</span><small>{session.count}</small></button>)}</div></Branch></div>)}</div></Branch>
              </div>)}
            </aside>

            <section className="written-folder-view" aria-busy={loadingPapers}>
              {loadingPapers && <PaperLoadingState tone="dark" message={`Opening ${selectedYear} papers…`} />}
              {!loadingPapers && sessionGroups.map((group) => <details className="written-paper-session" key={group.session} open>
                <summary><FolderOpen size={16} /><span>{group.session}</span><small>{group.papers.length} papers</small><ChevronRight size={14} className="written-folder-chevron" /></summary>
                <div className="written-paper-grid">{group.papers.map((paper) => <Link className="written-paper-card" key={paper.id} to={`/written-library/${paper.id}`}>
                  <span className="written-paper-code"><FilePenLine size={16} /> P{paper.component}</span>
                  <span className="written-paper-main"><b>{paper.title}</b><small>{paper.syllabusCode} / Variant {variantOf(paper)} / {TYPE_LABELS[paper.paperType] || 'Written paper'}</small></span>
                  <span className="written-paper-meta"><b>{paper.componentThreshold?.aMark ?? '--'}</b><small>A threshold</small></span>
                  <span className={`written-difficulty-pill written-difficulty-${paper.difficulty || 'unknown'}`}><Gauge size={13} /> {difficultyLabel(paper.difficulty || 'unknown')}</span>
                  <span className="written-paper-start">Open paper <ChevronRight size={16} /></span>
                </Link>)}</div>
              </details>)}
              {!loadingPapers && !visiblePapers.length && <div className="written-bank-empty"><b>No papers match those filters.</b><button type="button" onClick={clearSecondaryFilters}>Reset filters</button></div>}
              {!loadingPapers && visiblePapers.length > 0 && <p className="written-folder-caption">{selectedFolder?.subject} · {selectedYearFolder?.year} · {visiblePapers.length} paper{visiblePapers.length === 1 ? '' : 's'} shown</p>}
            </section>
          </section>
        </>}
      </section>
    </main>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  Gauge,
  RotateCcw,
  Search,
} from 'lucide-react';
import { libraryAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { accountKey, readSaved, saveSaved } from '../../components/studio/studyData';
import PaperLoadingState from '../../components/studio/PaperLoadingState';
import './LibraryPage.css';

const ALL = 'All';
const SESSION_ORDER = ['March', 'May/June', 'October/November'];
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

function Branch({ open, children }) {
  return <div className={`folder-collapse ${open ? 'is-open' : ''}`} inert={!open} aria-hidden={!open}>
    <div><div className="folder-branch">{children}</div></div>
  </div>;
}

function groupPapers(papers) {
  const subjects = new Map();

  papers.forEach((paper) => {
    if (!subjects.has(paper.subject)) subjects.set(paper.subject, new Map());
    const years = subjects.get(paper.subject);
    if (!years.has(paper.year)) years.set(paper.year, new Map());
    const sessions = years.get(paper.year);
    if (!sessions.has(paper.session)) sessions.set(paper.session, []);
    sessions.get(paper.session).push(paper);
  });

  return Array.from(subjects.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subjectName, years]) => ({
      subjectName,
      years: Array.from(years.entries())
        .sort(([a], [b]) => b - a)
        .map(([yearValue, sessions]) => ({
          yearValue,
          sessions: Array.from(sessions.entries())
            .sort(
              ([a], [b]) => SESSION_ORDER.indexOf(a) - SESSION_ORDER.indexOf(b),
            )
            .map(([sessionName, sessionPapers]) => ({
              sessionName,
              papers: sessionPapers.sort((a, b) =>
                a.component.localeCompare(b.component),
              ),
            })),
        })),
    }));
}

function foldersFromPapers(papers) {
  const folders = new Map();
  papers.forEach((paper) => {
    const key = [paper.subject, paper.syllabusCode, paper.year, paper.session, paper.sessionCode].join(':');
    const current = folders.get(key);
    if (current) {
      current.paperCount += 1;
      return;
    }
    folders.set(key, {
      subject: paper.subject,
      syllabusCode: paper.syllabusCode,
      year: paper.year,
      session: paper.session,
      sessionCode: paper.sessionCode,
      paperCount: 1,
    });
  });
  return [...folders.values()];
}

export default function LibraryPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const viewStateKey = `solvescript:library-view:${accountKey(user)}`;
  const initialView = readSaved(viewStateKey, {});
  const requestedSubject = searchParams.get('subject');
  const [folders, setFolders] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState(() => initialView.query || '');
  const [subject, setSubject] = useState(() => requestedSubject || initialView.subject || ALL);
  const [year, setYear] = useState(() => initialView.year || ALL);
  const [session, setSession] = useState(() => initialView.session || ALL);
  const [difficulty, setDifficulty] = useState(() => initialView.difficulty || ALL);
  const [expandedSubject, setExpandedSubject] = useState(() => requestedSubject || initialView.expandedSubject || null);
  const [expandedYear, setExpandedYear] = useState(() => initialView.expandedYear || null);

  useEffect(() => {
    saveSaved(viewStateKey, { query, subject, year, session, difficulty, expandedSubject, expandedYear });
  }, [difficulty, expandedSubject, expandedYear, query, session, subject, viewStateKey, year]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        try {
          const res = await libraryAPI.getCatalog();
          if (!ignore) setFolders(res.data.folders || []);
        } catch {
          // Keep the library usable while an older deployed backend is being restarted.
          const res = await libraryAPI.getAll();
          if (!ignore) setFolders(foldersFromPapers(res.data.papers || []));
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(
            error.response?.status === 503
              ? 'The paper library is reconnecting to its database. Try again shortly.'
              : 'The paper library could not be reached.',
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (subject === ALL || year === ALL || session === ALL) {
      return undefined;
    }

    const folder = folders.find((item) => (
      item.subject === subject
      && item.year === Number(year)
      && item.session === session
    ));
    if (!folder) return undefined;

    let ignore = false;
    libraryAPI.getAll({ subject, year, sessionCode: folder.sessionCode })
      .then((res) => {
        if (!ignore) {
          setLoadError('');
          setPapers(res.data.papers || []);
        }
      })
      .catch(() => {
        if (!ignore) setLoadError('The papers in this folder could not be reached.');
      })

    return () => {
      ignore = true;
    };
  }, [folders, session, subject, year]);

  const subjects = useMemo(
    () => [
      ALL,
      ...new Set(folders.map((folder) => folder.subject).filter(Boolean)),
    ],
    [folders],
  );
  const years = useMemo(
    () =>
      [ALL, ...new Set(folders
        .filter((folder) => subject === ALL || folder.subject === subject)
        .map((folder) => folder.year)
        .filter(Boolean))].sort(
        (a, b) => {
          if (a === ALL) return -1;
          if (b === ALL) return 1;
          return b - a;
        },
      ),
    [folders, subject],
  );
  const sessions = useMemo(
    () => [
      ALL,
      ...SESSION_ORDER.filter((item) =>
        folders.some((folder) => (
          folder.session === item
          && (subject === ALL || folder.subject === subject)
          && (year === ALL || folder.year === Number(year))
        )),
      ),
    ],
    [folders, subject, year],
  );
  const subjectStats = useMemo(
    () =>
      subjects
        .filter((item) => item !== ALL)
        .map((item) => ({
          name: item,
          count: folders
            .filter((folder) => folder.subject === item)
            .reduce((total, folder) => total + folder.paperCount, 0),
        })),
    [folders, subjects],
  );
  const catalogPaperCount = useMemo(
    () => folders.reduce((total, folder) => total + folder.paperCount, 0),
    [folders],
  );
  const hasSelectedSession = subject !== ALL && year !== ALL && session !== ALL;

  const visiblePapers = useMemo(() => {
    if (!hasSelectedSession) return [];
    const needle = query.trim().toLowerCase();
    return papers.filter((paper) => {
      const matchesQuery =
        !needle ||
        `${paper.title} ${paper.subject} ${paper.syllabusCode} ${paper.component} ${paper.year} ${paper.session}`
          .toLowerCase()
          .includes(needle);
      const matchesSubject =
        subject === ALL ||
        paper.subject === subject ||
        paper.subject.replace(/^A-Level\s+/i, '') === subject;
      const matchesYear = year === ALL || paper.year === Number(year);
      const matchesSession = session === ALL || paper.session === session;
      const matchesDifficulty =
        difficulty === ALL || (paper.difficulty || 'unknown') === difficulty;
      return matchesQuery && matchesSubject && matchesYear && matchesSession && matchesDifficulty;
    });
  }, [difficulty, hasSelectedSession, papers, query, session, subject, year]);
  const folderGroups = useMemo(
    () => groupPapers(visiblePapers),
    [visiblePapers],
  );
  const selectedYears = useMemo(
    () =>
      [...new Set(folders
        .filter((folder) => subject === ALL || folder.subject === subject)
        .map((folder) => folder.year))].sort(
        (a, b) => b - a,
      ),
    [folders, subject],
  );
  const resetFilters = () => {
    setQuery('');
    setSubject(ALL);
    setYear(ALL);
    setSession(ALL);
    setDifficulty(ALL);
    setExpandedSubject(null);
    setExpandedYear(null);
  };
  const hasActiveFilters = subject !== ALL || year !== ALL || session !== ALL || difficulty !== ALL || Boolean(query.trim());

  return (
    <main className="library-page">
      <div className="library-bg" aria-hidden="true" />
      <div className="container library-shell">
        <section className="library-hero">
          <span className="dash-kicker">
            <BookOpen size={15} aria-hidden="true" /> MCQ papers
          </span>
          <div className="library-title-row">
            <div>
              <h1>Your next blank page.</h1>
              <p>
                {loadError ||
                  (hasSelectedSession
                    ? `${visiblePapers.length} of ${papers.length} papers in this folder`
                    : `${catalogPaperCount} ready Paper 1 MCQs, arranged from 2015 onward`)}
              </p>
            </div>
            <img
              className="library-companion"
              src="/characters/sana-solve.png"
              alt="Sana Solve"
            />
          </div>
        </section>

        <section className="library-filters" aria-label="Paper filters">
          <label className="library-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subject, year, paper..."
              aria-label="Search papers"
            />
          </label>
          <div className="library-selects">
            <Filter size={17} aria-hidden="true" />
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              aria-label="Subject"
            >
              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
              aria-label="Year"
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={session}
              onChange={(event) => setSession(event.target.value)}
              aria-label="Session"
            >
              {sessions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              aria-label="Difficulty"
            >
              {DIFFICULTY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="library-browser">
          <aside className="folder-rail" aria-label="Paper folders">
            <button
              type="button"
              className={
                subject === ALL && year === ALL && session === ALL
                  ? 'is-active'
                  : ''
              }
              onClick={resetFilters}
              aria-label="Show all paper folders"
            >
              <span>
                {subject === ALL ? (
                  <FolderOpen size={16} aria-hidden="true" />
                ) : (
                  <Folder size={16} aria-hidden="true" />
                )}
                CAIE AS/A Level
              </span>
              <small>{catalogPaperCount}</small>
            </button>

            {subjectStats.map((item) => (
              <div className="folder-node" key={item.name}>
              <button
                type="button"
                className={subject === item.name ? 'is-active' : ''}
                aria-expanded={expandedSubject === item.name}
                aria-label={`${expandedSubject === item.name ? 'Collapse' : 'Expand'} ${item.name} paper folder`}
                onClick={() => {
                  setSubject(item.name);
                  setYear(ALL);
                  setSession(ALL);
                  setExpandedSubject(expandedSubject === item.name ? null : item.name);
                  setExpandedYear(null);
                }}
              >
                <span>
                  {subject === item.name ? (
                    <FolderOpen size={16} aria-hidden="true" />
                  ) : (
                    <Folder size={16} aria-hidden="true" />
                  )}
                  {item.name}
                </span>
                <small>{item.count}</small>
              </button>
              <Branch open={expandedSubject === item.name && subject === item.name}>
                {selectedYears.map((yearValue) => {
                  const sessionsForYear = SESSION_ORDER.filter((item) =>
                    folders.some(
                      (folder) => (
                        folder.year === yearValue
                        && folder.session === item
                        && (subject === ALL || folder.subject === subject)
                      ),
                    ),
                  );
                  return (
                  <div key={yearValue}>
                  <button
                    type="button"
                    className={year === String(yearValue) ? 'is-active' : ''}
                    aria-expanded={expandedYear === yearValue}
                    aria-label={`${expandedYear === yearValue ? 'Collapse' : 'Expand'} ${yearValue} paper folder`}
                    onClick={() => {
                      setYear(String(yearValue));
                      setSession(ALL);
                      setExpandedYear(expandedYear === yearValue ? null : yearValue);
                    }}
                  >
                    <span>
                      {year === String(yearValue) ? (
                        <FolderOpen size={16} aria-hidden="true" />
                      ) : (
                        <Folder size={16} aria-hidden="true" />
                      )}
                      {yearValue}
                    </span>
                    <small>
                      {
                        folders.filter(
                          (folder) => (
                            folder.year === yearValue
                            && (subject === ALL || folder.subject === subject)
                          ),
                        ).reduce((total, folder) => total + folder.paperCount, 0)
                      }
                    </small>
                  </button>
              <Branch open={expandedYear === yearValue}>
                {sessionsForYear.map((item) => (
                  <button
                    type="button"
                    className={session === item ? 'is-active' : ''}
                    key={item}
                    onClick={() => setSession(item)}
                    aria-label={`Show ${item} papers from ${yearValue}`}
                  >
                    <span>
                      {session === item ? (
                        <FolderOpen size={16} aria-hidden="true" />
                      ) : (
                        <Folder size={16} aria-hidden="true" />
                      )}
                      {item}
                    </span>
                    <small>
                      {
                        folders.filter(
                          (folder) =>
                            folder.year === yearValue &&
                            folder.session === item &&
                            (subject === ALL || folder.subject === subject),
                        ).reduce((total, folder) => total + folder.paperCount, 0)
                      }
                    </small>
                  </button>
                ))}
              </Branch>
                  </div>
                );})}
              </Branch>
              </div>
            ))}
          </aside>

          <section className="library-folder-view" aria-busy={loading}>
            {loading && <PaperLoadingState message="Opening the MCQ paper shelves…" />}
            {!loading && !loadError && !hasActiveFilters && (
              <div className="library-empty library-discovery">
                <b>Choose a subject folder to begin.</b>
                <span>Or search and filter the full Paper 1 collection above.</span>
              </div>
            )}
            {folderGroups.map((subjectGroup) => (
              <details
                className="folder-subject"
                key={subjectGroup.subjectName}
                open={subject !== ALL || !!query.trim() || year !== ALL || session !== ALL || difficulty !== ALL}
              >
                <summary className="folder-subject-heading">
                  <Folder size={19} aria-hidden="true" />
                  <div>
                    <h2>{subjectGroup.subjectName}</h2>
                    <span>{subjectGroup.years.length} year folders</span>
                  </div>
                  <ChevronRight size={16} className="folder-chevron" />
                </summary>

                {subjectGroup.years.map((yearGroup) => (
                  <details
                    className="folder-year"
                    key={`${subjectGroup.subjectName}-${yearGroup.yearValue}`}
                    open={year !== ALL || !!query.trim() || session !== ALL || difficulty !== ALL}
                  >
                    <summary className="folder-year-heading">
                      <Folder size={17} aria-hidden="true" />
                      <b>{yearGroup.yearValue}</b>
                      <ChevronRight size={14} className="folder-chevron" />
                    </summary>

                    {yearGroup.sessions.map((sessionGroup) => (
                      <details
                        className="folder-session"
                        key={`${subjectGroup.subjectName}-${yearGroup.yearValue}-${sessionGroup.sessionName}`}
                        open={year !== ALL || !!query.trim() || session !== ALL || difficulty !== ALL}
                      >
                        <summary className="folder-session-heading">
                          <FolderOpen size={16} aria-hidden="true" />
                          <span>{sessionGroup.sessionName}</span>
                          <small>{sessionGroup.papers.length} papers</small>
                          <ChevronRight size={14} className="folder-chevron" />
                        </summary>

                        <div className="library-grid">
                          {sessionGroup.papers.map((paper) => (
                            <Link
                              to={`/solve/library/${paper.id}`}
                              state={{ paper }}
                              className="library-card"
                              key={paper.id}
                            >
                              <span className="library-card-code">
                                <FileText size={17} aria-hidden="true" />P
                                {paper.component}
                              </span>
                              <span className="library-card-main">
                                <b>{paper.title}</b>
                                <small>
                                  {paper.syllabusCode} / {paper.session}{' '}
                                  {paper.year} / {paper.totalQuestions} MCQs
                                </small>
                              </span>
                              <span className="library-card-meta">
                                <b>{paper.componentThreshold?.aMark ?? '--'}</b>
                                <small>A threshold</small>
                              </span>
                              <span className={`difficulty-pill difficulty-${paper.difficulty || 'unknown'}`}>
                                <Gauge size={13} aria-hidden="true" />
                                {difficultyLabel(paper.difficulty || 'unknown')}
                              </span>
                              <span className="library-start">
                                Open paper{' '}
                                <ChevronRight size={16} aria-hidden="true" />
                              </span>
                            </Link>
                          ))}
                        </div>
                      </details>
                    ))}
                  </details>
                ))}
              </details>
            ))}
            {!loading && !loadError && hasActiveFilters && !hasSelectedSession && (
              <div className="library-empty">
                <b>Choose a year and session.</b>
                <span>The paper cards load only for the folder you open.</span>
              </div>
            )}
            {loadError && !loading && (
              <div className="library-empty">
                <b>MCQ library unavailable.</b>
                <span>{loadError}</span>
              </div>
            )}
            {!loadError && hasSelectedSession && !visiblePapers.length && !loading && (
              <div className="library-empty">
                <b>No papers match those filters.</b>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={resetFilters}
                >
                  <RotateCcw size={14} aria-hidden="true" /> Reset filters
                </button>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

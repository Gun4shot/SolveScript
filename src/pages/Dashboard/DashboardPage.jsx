import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Atom,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dna,
  Flame,
  FlaskConical,
  TrendingUp,
  Trash2,
  Upload,
  FilePenLine,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { attemptsAPI, libraryAPI, writtenAttemptsAPI } from '../../services/api';
import {
  accountKey,
  cleanSubject,
  dateKey,
  readSaved,
  useStudyData,
} from '../../components/studio/studyData';
import { useStudio } from '../../components/studio/StudioContext';
import DeskScene from '../../components/studio/DeskScene';
import FocusTimer from '../../components/studio/FocusTimer';
import StudioDialog from '../../components/studio/StudioDialog';
import './DashboardPage.css';

const subjects = [
  ['Physics', '9702', Atom, 'blue'],
  ['Chemistry', '9701', FlaskConical, 'coral'],
  ['Biology', '9700', Dna, 'mint'],
  ['Economics', '9708', TrendingUp, 'yellow'],
];

function removeOngoingSession(path, owner) {
  try {
    const saved = readSaved('solvescript:ongoingTests', []);
    const next = Array.isArray(saved) ? saved.filter((test) => test.path !== path || (test.owner || 'guest') !== owner) : [];
    if (next.length) localStorage.setItem('solvescript:ongoingTests', JSON.stringify(next));
    else localStorage.removeItem('solvescript:ongoingTests');
  } catch {
    // The server draft deletion remains available when local storage is unavailable.
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { preferences } = useStudio();
  const { attempts, loading, error } = useStudyData();
  const [papers, setPapers] = useState([]);
  const [libraryError, setLibraryError] = useState('');
  const [calendar, setCalendar] = useState(false);
  const [removingPath, setRemovingPath] = useState('');
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const todayRef = useRef(null);
  const [ongoing, setOngoing] = useState(() => {
    const value = readSaved('solvescript:ongoingTests', []);
    return Array.isArray(value)
      ? value.filter(
          (test) =>
            (test.owner || 'guest') === accountKey(user) &&
            /^\/solve\//.test(test.path),
        ).map((test) => ({
          ...test,
          draftType: 'local',
          paperId: test.path?.split('/').filter(Boolean).at(-1),
          paperSource: test.path?.startsWith('/solve/library/') ? 'library' : 'upload',
        }))
      : [];
  });
  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    Promise.all([writtenAttemptsAPI.getAll(), attemptsAPI.getDrafts()])
      .then(([writtenResponse, paperOneResponse]) => {
        if (!active) return;
        const writtenDrafts = (writtenResponse.data.attempts || [])
          .filter((attempt) => attempt.status === 'draft')
          .map((attempt) => ({
            path: `/written/attempt/${attempt.id}`,
            owner: accountKey(user),
            title: attempt.paper.title,
            subject: attempt.paper.subject,
            mode: attempt.mode,
            answered: attempt.currentPage ? `page ${attempt.currentPage}` : 'not started',
            written: true,
            draftType: 'written',
            id: attempt.id,
          }));
        const cloudPaperOneDrafts = (paperOneResponse.data.attempts || []).map((attempt) => ({
          path: attempt.paper?.id ? `${attempt.source === 'library' ? '/solve/library/' : '/solve/'}${attempt.paper.id}` : '',
          owner: accountKey(user),
          title: attempt.paper?.title || 'Paper 1',
          subject: attempt.paper?.subject || 'Paper 1',
          mode: attempt.mode,
          answered: Object.values(attempt.draft?.selectedAnswers || {}).filter(Boolean).length,
          draftType: 'paper-one',
          id: attempt.id,
          paperId: attempt.paper?.id,
          paperSource: attempt.source,
        })).filter((attempt) => attempt.path);
        const local = readSaved('solvescript:ongoingTests', []);
        const paperOneDrafts = Array.isArray(local)
          ? local.filter((test) => (test.owner || 'guest') === accountKey(user)).map((test) => ({
            ...test,
            draftType: 'local',
            paperId: test.path?.split('/').filter(Boolean).at(-1),
            paperSource: test.path?.startsWith('/solve/library/') ? 'library' : 'upload',
          }))
          : [];
        const cloudDrafts = [...writtenDrafts, ...cloudPaperOneDrafts];
        setOngoing([...cloudDrafts, ...paperOneDrafts.filter((test) => !cloudDrafts.some((draft) => draft.path === test.path))]);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user]);

  const deleteOngoingSession = async (test) => {
    if (!window.confirm(`Remove “${test.title}” from your desk? Its unfinished work will be deleted.`)) return;
    setRemovingPath(test.path);
    try {
      if (test.draftType === 'written') await writtenAttemptsAPI.delete(test.id);
      if (test.draftType === 'paper-one') await attemptsAPI.deleteDraft(test.id);
      if (test.paperId) {
        try { localStorage.removeItem(`solvescript:draft:${accountKey(user)}:${test.paperSource}:${test.paperId}`); } catch { /* The remote draft was still removed. */ }
      }
      removeOngoingSession(test.path, accountKey(user));
      setOngoing((current) => current.filter((item) => item.path !== test.path));
      toast.success('Unfinished session deleted from your desk.');
    } catch {
      toast.error('This session could not be deleted. Please try again.');
    } finally {
      setRemovingPath('');
    }
  };
  useEffect(() => {
    let active = true;
    libraryAPI
      .getAll()
      .then((res) => {
        if (active) setPapers(res.data.papers || []);
      })
      .catch(() => {
        if (active)
          setLibraryError(
            'The library is unavailable right now. Please try again shortly.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const strip = todayRef.current?.parentElement;
    if (strip)
      strip.scrollLeft = Math.max(
        0,
        todayRef.current.offsetLeft - strip.offsetLeft - strip.clientWidth / 2,
      );
  }, []);
  const today = dateKey(new Date());
  const activeDates = useMemo(
    () =>
      new Set(
        attempts.map((a) => dateKey(new Date(a.completedAt || a.createdAt))),
      ),
    [attempts],
  );
  let streak = 0;
  const cursor = new Date();
  if (!activeDates.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (activeDates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const daysFor = (date) =>
    Array.from(
      {
        length: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      },
      (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1),
    );
  const monthDays = daysFor(new Date());
  const todayCount = attempts.filter(
    (a) => dateKey(new Date(a.completedAt)) === today,
  ).length;
  const questionCount = attempts.reduce(
    (sum, a) => sum + (a.totalCorrect || 0) + (a.totalWrong || 0),
    0,
  );
  const correctCount = attempts.reduce(
    (sum, a) => sum + (a.totalCorrect || 0),
    0,
  );
  const accuracy = questionCount
    ? Math.round((correctCount / questionCount) * 100)
    : 0;
  const goal = preferences.goal || 1;
  return (
    <main className="desk-page">
      <section className="desk-welcome" aria-labelledby="desk-title">
        <div className="desk-sky" aria-hidden="true" />
        <div className="desk-welcome-copy">
          <span className="studio-label">YOUR NEXT CHAPTER STARTS HERE</span>
          <p className="desk-hello">
            {user?.name ? `Hello, ${user.name.split(' ')[0]}. Welcome to your desk.` : 'Welcome to your desk.'}
          </p>
          <h1 id="desk-title">
            Small steps.
            <br />
            <em>Big possibilities.</em>
          </h1>
          <p className="desk-intro">
            A fresh page, a little curiosity.
            <br />
            Let's see what you can do today.
          </p>
          <div className="desk-welcome-actions">
            <Link className="studio-primary" to="/library">
              Start a paper <ArrowUpRight size={18} />
            </Link>
            <a href="#your-subjects" className="studio-text-button">
              Find your subject <ArrowDown size={16} />
            </a>
          </div>
        </div>
        <DeskScene />
        <span className="desk-edition">
          THE DAILY EDITION <i />{' '}
          {new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: '2-digit',
          })
            .format(new Date())
            .toUpperCase()}
        </span>
      </section>
      <div className="desk-body">
        <section className="desk-streak" data-tour="streak">
          <div className="streak-overview">
            <span className="studio-flame">
              <Flame size={26} fill="currentColor" />
            </span>
            <div>
              <b>
                {streak} day{streak === 1 ? '' : 's'} <span>in a row</span>
              </b>
              <small>
                {streak
                  ? 'Keep your little ritual going.'
                  : 'A fresh streak starts with one paper.'}
              </small>
            </div>
            <button
              className="studio-text-button"
              onClick={() => setCalendar(true)}
            >
              View calendar <ArrowUpRight size={14} />
            </button>
          </div>
          <div
            className="desk-day-strip"
            aria-label="This month's study streak"
          >
            {monthDays.map((date) => {
              const key = dateKey(date),
                active = activeDates.has(key);
              return (
                <button
                  key={key}
                  ref={key === today ? todayRef : undefined}
                  onClick={() => setCalendar(true)}
                  className={`desk-day ${active ? 'completed' : ''} ${key === today ? 'today' : ''} ${key > today ? 'future' : ''}`}
                  aria-label={`${date.toDateString()}${active ? ', paper completed' : ''}${key === today ? ', today' : ''}`}
                >
                  <small>
                    {new Intl.DateTimeFormat(undefined, { weekday: 'short' })
                      .format(date)
                      .slice(0, 1)}
                  </small>
                  <span>{active ? <Flame size={17} /> : date.getDate()}</span>
                  {key === today && <i />}
                </button>
              );
            })}
          </div>
        </section>
        {error && (
          <p className="studio-notice" role="status">
            {error}
          </p>
        )}
        <div className="desk-columns">
          <div className="desk-main-column">
            <section
              className="desk-subjects"
              id="your-subjects"
            >
              <div className="studio-section-heading" data-tour="subjects">
                <div>
                  <span className="studio-label">MAKE SOMETHING OF TODAY</span>
                  <h2>Where shall we begin?</h2>
                </div>
                <Link className="studio-text-button" to="/library">
                  All papers <ArrowRight size={16} />
                </Link>
              </div>
              <div className="subject-shelves">
                {subjects.map(([name, code, icon, tone]) => {
                  const count = papers.filter(
                    (p) => cleanSubject(p.subject) === name,
                  ).length;
                  return (
                    <Link
                      key={code}
                      className={`subject-shelf shelf-${tone}`}
                      to={`/library?subject=${encodeURIComponent(name)}`}
                    >
                      <span className="shelf-tab">{code}</span>
                      <div className="shelf-top">
                        {createElement(icon, { size: 28, strokeWidth: 1.6 })}
                        <ArrowUpRight size={19} />
                      </div>
                      <h3>{name}</h3>
                      <span>
                        {count ? `${count} papers` : 'Browse papers'} <i /> AS &
                        A Level
                      </span>
                      <div className="shelf-foot">
                        Open subject <ArrowRight size={15} />
                      </div>
                    </Link>
                  );
                })}
              </div>
              {libraryError && (
                <p className="studio-notice" role="status">
                  {libraryError}
                </p>
              )}
            </section>
            <section className="desk-ongoing" data-tour="ongoing">
              <div className="studio-section-heading">
                <div>
                  <span className="studio-label">RIGHT WHERE YOU LEFT IT</span>
                  <h2>
                    On your desk{' '}
                    <span className="heading-count">{ongoing.length}</span>
                  </h2>
                </div>
                <Clock3 size={20} />
              </div>
              {ongoing.length ? (
                ongoing.map((test) => (
                  <article className="desk-ongoing-row" key={test.path}>
                    <Link className="desk-ongoing-resume" to={test.path}>
                    <span className="ongoing-paper-icon">
                      {test.written ? <FilePenLine size={23} /> : <BookOpen size={23} />}
                    </span>
                    <div>
                      <b>{test.title}</b>
                      <small>
                        {test.subject} / {test.mode} / {test.written ? test.answered : `${test.answered || 0} answered`}
                      </small>
                    </div>
                    <span className="resume-label">Continue</span>
                    <ArrowUpRight size={18} />
                    </Link>
                    <button className="desk-ongoing-delete" type="button" onClick={() => void deleteOngoingSession(test)} disabled={removingPath === test.path} aria-label={`Delete unfinished ${test.title}`} title="Delete this unfinished session"><Trash2 size={16} /></button>
                  </article>
                ))
              ) : (
                <div className="desk-clear">
                  <img src="/characters/sana-solve.png" alt="Sana Solve" />
                  <div>
                    <h3>A clear desk. A fresh start.</h3>
                    <p>No unfinished papers. Your next one is waiting.</p>
                    <Link to="/library" className="studio-text-button">
                      Find a paper <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              )}
            </section>
            <Link className="desk-upload" to="/upload">
              <Upload size={23} />
              <div>
                <b>Have a paper of your own?</b>
                <span>Bring your question paper and mark scheme.</span>
              </div>
              <ArrowUpRight size={21} />
            </Link>
          </div>
          <aside className="desk-side-column">
            <section className="desk-goal">
              <span className="studio-label">YOUR DAILY INTENTION</span>
              <div className="goal-heading">
                <h2>One paper closer.</h2>
                <span className="goal-check">
                  {todayCount >= goal ? (
                    <Check size={21} />
                  ) : (
                    <BookOpen size={21} />
                  )}
                </span>
              </div>
              <p>
                {Math.min(todayCount, goal)} of {goal} paper
                {goal === 1 ? '' : 's'} finished today
              </p>
              <div
                className="goal-track"
                role="progressbar"
                aria-label="Daily paper goal"
                aria-valuenow={Math.min(todayCount, goal)}
                aria-valuemin={0}
                aria-valuemax={goal}
              >
                <i
                  style={{ width: `${Math.min(todayCount / goal, 1) * 100}%` }}
                />
              </div>
              <Link className="studio-text-button" to="/settings">
                Set your pace <ArrowUpRight size={14} />
              </Link>
            </section>
            <FocusTimer />
            <section className="desk-pulse" aria-busy={loading}>
              <div className="studio-section-heading">
                <h2>The bigger picture</h2>
                <ChartNoAxesCombined size={20} />
              </div>
              <div>
                <span>
                  <b>{attempts.length}</b>
                  <small>Papers finished</small>
                </span>
                <span>
                  <b>
                    {accuracy}
                    <i>%</i>
                  </b>
                  <small>Answer accuracy</small>
                </span>
              </div>
              <Link to="/analytics" className="studio-text-button">
                Explore your progress <ArrowRight size={16} />
              </Link>
            </section>
          </aside>
        </div>
        <footer className="desk-footer">
          <span>PROGRESS IS A PRACTICE, NOT A RACE.</span>
          <span>Made for your next possibility.</span>
        </footer>
      </div>
      {calendar && (
        <StudioDialog title="Study calendar" onClose={() => setCalendar(false)}>
          <span className="studio-label">YOUR STUDY DAYS</span>
          <div className="calendar-navigation">
            <button
              className="studio-icon"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={20} />
            </button>
            <h2>
              {new Intl.DateTimeFormat(undefined, {
                month: 'long',
                year: 'numeric',
              }).format(month)}
            </h2>
            <button
              className="studio-icon"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="calendar-summary">
            <span>
              <Flame size={20} /> {streak} day streak
            </span>
            <span>{activeDates.size} study days</span>
          </div>
          <div className="desk-calendar">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <small key={day}>{day}</small>
            ))}
            {Array.from({ length: (month.getDay() + 6) % 7 }, (_, i) => (
              <span key={`space-${i}`} />
            ))}
            {daysFor(month).map((date) => (
              <span
                key={date.getDate()}
                className={`${activeDates.has(dateKey(date)) ? 'completed' : ''} ${dateKey(date) === today ? 'today' : ''}`}
                title={
                  activeDates.has(dateKey(date))
                    ? 'Paper completed'
                    : 'No completed papers'
                }
              >
                {date.getDate()}
              </span>
            ))}
          </div>
          <p className="calendar-legend">
            <i /> A paper completed <span>Outlined: today</span>
          </p>
        </StudioDialog>
      )}
    </main>
  );
}

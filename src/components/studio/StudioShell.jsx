import { createElement, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  FilePenLine,
  FolderArchive,
  ChartNoAxesCombined,
  CircleHelp,
  House,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { accountKey, characters, readSaved } from './studyData';
import TourPopover from './TourPopover';
import { StudioContext } from './StudioContext';
import './StudioShell.css';

const links = [
  ['/dashboard', 'My desk', House],
  ['/library', 'MCQ papers', BookOpen],
  ['/written-library', 'Subjective papers', FilePenLine],
  ['/written-progress', 'Paper collections', FolderArchive],
  ['/analytics', 'My progress', ChartNoAxesCombined],
  ['/upload', 'Upload papers', Upload],
];
const tour = [
  [
    'Welcome to your desk.',
    'I am Mira, your study companion. Let me show you around your new space.',
    'mira',
    null,
  ],
  [
    'A little practice, every day.',
    'Your streak records the days you finish a paper. Open the calendar to look back through your study days.',
    'mira',
    'streak',
  ],
  [
    'Find your next paper.',
    'Choose a subject, then browse year and exam session folders. Search and filters work together. Pick casual practice or a timed exam before you begin.',
    'sana',
    'subjects',
  ],
  [
    'Pick up where you left off.',
    'Unfinished papers live here. Your answers are saved on this device as you work.',
    'sana',
    'ongoing',
  ],
  [
    'Make room for focus.',
    'Theo keeps a 25-minute focus timer beside your work. Start, pause, or reset whenever you need.',
    'theo',
    'focus',
  ],
  [
    'Watch your work add up.',
    'My progress brings together finished papers, accuracy, and subject trends. Preferences lets you choose a companion and reduce motion. Your desk is ready!',
    'theo',
    null,
  ],
];

export default function StudioShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = `solvescript:preferences:${accountKey(user)}`;
  const [preferences, setPreferences] = useState(() =>
    readSaved(storageKey, { companion: 'mira', motion: true, goal: 1 }),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarKey = `solvescript:sidebar-collapsed:${accountKey(user)}`;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSaved(sidebarKey, false));
  const [step, setStep] = useState(null);
  const tourKey = `solvescript:tour:v2:${accountKey(user)}`;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreferences(
        readSaved(storageKey, { companion: 'mira', motion: true, goal: 1 }),
      );
      if (location.pathname === '/dashboard' && !readSaved(tourKey, false))
        setStep(0);
    }, 700);
    return () => clearTimeout(timer);
  }, [storageKey, tourKey, location.pathname]);
  const finishTour = useCallback(() => {
    try {
      localStorage.setItem(tourKey, 'true');
    } catch {
      /* A tour can still close when storage is unavailable. */
    }
    setStep(null);
  }, [tourKey]);
  const startTour = () => { navigate('/dashboard'); setStep(0); };
  const updatePreferences = (changes) => {
    const next = { ...preferences, ...changes };
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Preferences remain active for this visit. */
    }
  };
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try { localStorage.setItem(sidebarKey, JSON.stringify(next)); } catch { /* The setting remains active for this visit. */ }
  };
  const companion =
    characters.find((item) => item.id === preferences.companion) ||
    characters[0];
  const focusMode = location.pathname.startsWith('/solve/') || location.pathname.startsWith('/written/attempt/');
  const tourCharacter =
    step === null
      ? characters[0]
      : characters.find((item) => item.id === tour[step][2]);
  return (
    <StudioContext.Provider
      value={{
        preferences,
        updatePreferences,
        companion,
        startTour,
      }}
    >
      <div
        className={`studio-app ${focusMode ? 'studio-focus' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${preferences.motion === false ? 'motion-off' : ''}`}
      >
        {!focusMode && (
          <>
            {menuOpen && (
              <button
                className="studio-nav-scrim"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              />
            )}
            <aside className={`studio-sidebar ${menuOpen ? 'is-open' : ''}`}>
              <div className="studio-sidebar-head">
                <Link className="studio-brand" to="/">
                  <img src="/solvescript-character-mark-v1.png" alt="" />
                  <span>
                    solve<i>script</i>
                    <small>THE STUDY STUDIO</small>
                  </span>
                </Link>
                <button
                  className="sidebar-collapse-toggle"
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  onClick={toggleSidebar}
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                  <span>{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
                </button>
              </div>
              <button
                className="studio-icon mobile-nav-close"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              >
                <X size={20} />
              </button>
              <span className="studio-label sidebar-label">YOUR WORKSPACE</span>
              <nav aria-label="Study navigation">
                {links.map(([path, label, icon]) => (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `studio-nav-link ${isActive ? 'active' : ''}`
                    }
                  >
                    {createElement(icon, { size: 19 })}
                    <span>{label}</span>
                    {path === '/library' && <ArrowUpRight size={14} />}
                  </NavLink>
                ))}
              </nav>
              <div className="sidebar-companion">
                <img src={companion.file} alt={companion.name} />
                <p>{companion.note}</p>
                <span>{companion.name}</span>
              </div>
              <div className="sidebar-bottom">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    startTour();
                  }}
                  className="studio-nav-link"
                >
                  <CircleHelp size={18} /> Take a tour
                </button>
                <NavLink
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="studio-nav-link"
                >
                  <Settings2 size={18} /> Preferences
                </NavLink>
                <div className="studio-account">
                  <span>{(user?.name || 'You').slice(0, 1)}</span>
                  <div>
                    <b>{user?.name || 'Your study space'}</b>
                    <small>
                      {user
                        ? 'Personal workspace'
                        : 'Guest / saved on this device'}
                    </small>
                  </div>
                  {user && (
                    <button
                      className="studio-icon"
                      onClick={logout}
                      title="Log out"
                      aria-label="Log out"
                    >
                      <LogOut size={17} />
                    </button>
                  )}
                </div>
              </div>
            </aside>
          </>
        )}
        <div className="studio-content" key={location.pathname}>
          {!focusMode && (
            <button className="studio-icon mobile-nav-open studio-floating-mobile-nav" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
              <Menu size={21} />
            </button>
          )}
          {children}
        </div>
        {step !== null && (
          <TourPopover
            targetId={tour[step][3]}
            step={step}
            onClose={finishTour}
          >
            <img
              className="tour-character"
              src={tourCharacter.file}
              alt={tourCharacter.name}
            />
            <div className="tour-copy">
              <span className="studio-label">
                {tourCharacter.name} / {step + 1} OF {tour.length}
              </span>
              <h2>{tour[step][0]}</h2>
              <p>{tour[step][1]}</p>
              <div
                className="tour-dots"
                aria-label={`Step ${step + 1} of ${tour.length}`}
              >
                {tour.map((_, index) => (
                  <i key={index} className={index === step ? 'active' : ''} />
                ))}
              </div>
              <div className="tour-actions">
                <button className="studio-text-button" onClick={finishTour}>
                  Skip tour
                </button>
                {step > 0 && (
                  <button
                    className="studio-text-button"
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </button>
                )}
                <button
                  className="studio-primary"
                  onClick={() =>
                    step === tour.length - 1 ? finishTour() : setStep(step + 1)
                  }
                >
                  {step === tour.length - 1 ? 'Make yourself at home' : 'Next'}
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          </TourPopover>
        )}
      </div>
    </StudioContext.Provider>
  );
}

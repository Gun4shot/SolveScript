import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { readSaved } from './studyData';
import StudioDialog from './StudioDialog';

const DURATION = 25 * 60;
export default function FocusTimer() {
  const [timer, setTimer] = useState(() =>
    readSaved('solvescript:focus', { remaining: DURATION, end: null }),
  );
  const [now, setNow] = useState(Date.now);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const remaining = timer.end
    ? Math.max(0, Math.ceil((timer.end - now) / 1000))
    : timer.remaining;
  useEffect(() => {
    if (!timer.end || timer.end <= Date.now()) return;
    const interval = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= timer.end) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, [timer.end]);
  const update = (next) => {
    setNow(Date.now());
    setTimer(next);
    try {
      localStorage.setItem('solvescript:focus', JSON.stringify(next));
    } catch {
      /* The timer still works without persistence. */
    }
  };
  return (
    <section className="focus-station" data-tour="focus">
      <div className="studio-section-heading">
        <div>
          <span className="studio-label">A MOMENT OF FOCUS</span>
          <h2>Your time, well spent.</h2>
        </div>
      </div>
      <div className="focus-clock">
        <img src="/characters/theo-tally.png" alt="Theo Tally" />
        <div>
          <span
            className="timer-digits"
            role="timer"
            aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds`}
          >
            {String(Math.floor(remaining / 60)).padStart(2, '0')}
            <i>:</i>
            {String(remaining % 60).padStart(2, '0')}
          </span>
          <small role="status">
            {remaining === 0
              ? 'Session complete. Take a breather.'
              : timer.end
                ? 'One thing at a time.'
                : '25 minutes. Just you and the paper.'}
          </small>
        </div>
      </div>
      <div className="focus-actions">
        <button
          className="studio-primary"
          onClick={() =>
            update(
              timer.end && remaining > 0
                ? { remaining, end: null }
                : {
                    remaining: remaining || DURATION,
                    end: Date.now() + (remaining || DURATION) * 1000,
                  },
            )
          }
        >
          {timer.end && remaining > 0 ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
          {timer.end && remaining > 0
            ? 'Pause focus'
            : remaining < DURATION && remaining > 0
              ? 'Resume focus'
              : 'Start focus'}
        </button>
        <button
          className="studio-icon"
          title="Reset timer"
          aria-label="Reset timer"
          onClick={() => setResetConfirmOpen(true)}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      {resetConfirmOpen && <StudioDialog title="Reset focus timer" onClose={() => setResetConfirmOpen(false)}>
        <span className="studio-label">FOCUS TIMER</span>
        <h2>Start this focus session over?</h2>
        <p>Your current countdown will be replaced with a fresh 25 minutes.</p>
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={() => setResetConfirmOpen(false)}>Keep current timer</button>
          <button className="btn btn-primary" type="button" onClick={() => { update({ remaining: DURATION, end: null }); setResetConfirmOpen(false); }}>Reset timer</button>
        </div>
      </StudioDialog>}
    </section>
  );
}

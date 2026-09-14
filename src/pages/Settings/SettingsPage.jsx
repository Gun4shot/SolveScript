import { Check, CircleHelp } from 'lucide-react';
import { useStudio } from '../../components/studio/StudioContext';
import { characters } from '../../components/studio/studyData';

export default function SettingsPage() {
  const { preferences, updatePreferences, startTour } = useStudio();
  return (
    <main className="settings-page">
      <span className="studio-label">A SPACE THAT FEELS LIKE YOU</span>
      <h1 className="studio-page-title">Make yourself at home.</h1>
      <p className="studio-page-subtitle">
        Your pace. Your companion. Your way of working.
      </p>
      <section className="settings-section">
        <h2>Meet your study companion.</h2>
        <div className="companion-options">
          {characters.map((character) => (
            <label className="companion-option" key={character.id}>
              <input
                type="radio"
                name="companion"
                value={character.id}
                checked={preferences.companion === character.id}
                onChange={() => updatePreferences({ companion: character.id })}
              />
              <img src={character.file} alt="" />
              <b>{character.name}</b>
            </label>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h2>Find your rhythm.</h2>
        <label className="settings-row">
          <span>
            <b>Daily paper goal</b>
            <small>A little intention for each study day.</small>
          </span>
          <select
            value={preferences.goal || 1}
            onChange={(event) =>
              updatePreferences({ goal: Number(event.target.value) })
            }
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} paper{n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-row">
          <span>
            <b>Characters & motion</b>
            <small>
              Animated companions and the interactive desk. Your device's
              reduced-motion setting always takes priority.
            </small>
          </span>
          <input
            type="checkbox"
            checked={preferences.motion !== false}
            onChange={(event) =>
              updatePreferences({ motion: event.target.checked })
            }
          />
        </label>
        <div className="settings-row">
          <span>
            <b>A little help getting around</b>
            <small>Meet your workspace again, at any time.</small>
          </span>
          <button className="studio-text-button" onClick={startTour}>
            <CircleHelp size={18} /> Replay tour
          </button>
        </div>
        <p className="settings-saved">
          <Check size={15} /> Preferences are saved automatically on this
          device.
        </p>
      </section>
    </main>
  );
}

// Settings (§9.5/P6): stretch, narration, click source, volume, mic report, redo setup, reset progress.
import { useState } from 'react';
import { isNative } from '../native/echoNative';
import { STRETCH_STEPS } from '../config';
import { getSettingsReport } from '../audio/micDetector';
import { spokenNumber } from '../levels/feedback';
import { resetProgress, setOnboarded } from '../state/progress';
import { say, setClickSource } from '../state/runner';
import { useEcho, type ClickSource, type Narration } from '../state/store';
import { stretchLabel } from './labels';

type Props = { onClose: () => void };

export function Settings({ onClose }: Props) {
  const settings = useEcho((s) => s.settings);
  const setSettings = useEcho((s) => s.setSettings);
  const patch = useEcho((s) => s.patch);
  const micOn = useEcho((s) => s.micOn);
  const [confirmReset, setConfirmReset] = useState(false);
  const [note, setNote] = useState('');

  const redoSetup = () => {
    setOnboarded(false);
    patch({ phase: 'onboarding', levelId: null, trial: null, message: 'Echo. Press Start.' });
    onClose();
  };

  const doReset = () => {
    resetProgress();
    setConfirmReset(false);
    setNote('Progress reset.');
    void say('Progress reset.');
  };

  return (
    <section className="settings" aria-label="Settings">
      <h2>Settings</h2>

      <label>
        Echo speed
        <select value={settings.stretch} onChange={(e) => setSettings({ stretch: Number(e.target.value) })}>
          {STRETCH_STEPS.map((s) => (
            <option key={s} value={s}>
              {stretchLabel(s)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Narration
        <select value={settings.narration} onChange={(e) => setSettings({ narration: e.target.value as Narration })}>
          <option value="voice">Spoken voice</option>
          <option value="screenreader">My screen reader</option>
        </select>
      </label>

      <label>
        Morse code feedback
        <select
          value={settings.morse}
          onChange={(e) => setSettings({ morse: e.target.value as 'off' | 'vibration' | 'sound' })}
        >
          <option value="off">Off</option>
          <option value="vibration">Vibration</option>
          <option value="sound">Beeps</option>
        </select>
      </label>

      {isNative() && (
        <label>
          Volume buttons
          <select
            value={settings.volumeKeys ? 'actions' : 'system'}
            onChange={(e) => setSettings({ volumeKeys: e.target.value === 'actions' })}
          >
            <option value="actions">Up clicks, down replays</option>
            <option value="system">Change the phone volume</option>
          </select>
        </label>
      )}

      <label>
        Click source
        <select
          value={settings.clickSource}
          onChange={(e) => void setClickSource(e.target.value as ClickSource)}
        >
          <option value="key">Space key</option>
          <option value="mic">My tongue click (microphone)</option>
        </select>
      </label>
      <p>{micOn ? `Mic on. ${getSettingsReport()}` : 'Mic off.'}</p>

      <label>
        Volume {spokenNumber(Math.round(settings.volume * 100))} percent
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(e) => setSettings({ volume: Number(e.target.value) })}
        />
      </label>

      <div className="settings-actions">
        <button type="button" onClick={redoSetup}>
          Redo setup
        </button>
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => {
              setConfirmReset(true);
              void say('Delete all scores on this device? Press Yes to reset, or No to keep them.');
            }}
          >
            Reset progress
          </button>
        ) : (
          <>
            <p>Delete all scores on this device?</p>
            <button type="button" onClick={doReset} autoFocus>
              Yes, reset
            </button>
            <button type="button" onClick={() => setConfirmReset(false)}>
              No, keep them
            </button>
          </>
        )}
        <button type="button" onClick={onClose}>
          Close settings
        </button>
      </div>
      <p role="status">{note}</p>
    </section>
  );
}

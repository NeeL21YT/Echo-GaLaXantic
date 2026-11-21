// Settings (§9.5/P6): stretch, narration, click source, volume, mic report, redo setup, reset progress.
// Every change is applied and saved at once (App subscribes to the store) and spoken in the active narration mode.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { isNative } from '../native/echoNative';
import { DEFAULT_STRETCH, STORAGE_LIMITS, STRETCH_STEPS } from '../config';
import { spokenNumber } from '../levels/feedback';
import { resetProgress, setOnboarded } from '../state/progress';
import { abortRun, pauseMic, say, setClickSource } from '../state/runner';
import { useEcho, type ClickSource, type Narration, type Settings as SettingsValues } from '../state/store';
import { LEVEL_LIST_HEADING, START_PROMPT, levelSelectPrompt } from './labels';

type Props = { onClose: () => void };
type Confirm = 'reset' | 'redo' | null;

/** Echo speed in words, so it is spoken and shown the same way. */
const stretchWords = (stretch: number): string =>
  stretch === 1 ? 'real speed' : `${stretch === 1.5 ? 'one and a half' : spokenNumber(stretch)} times slower`;

const volumeText = (v: number) => `Volume ${spokenNumber(Math.round(v * 100))} percent.`;

export function Settings({ onClose }: Props) {
  const settings = useEcho((s) => s.settings);
  const setSettings = useEcho((s) => s.setSettings);
  const patch = useEcho((s) => s.patch);
  const micOn = useEcho((s) => s.micOn);
  const screenReaderOn = useEcho((s) => s.screenReaderOn);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [note, setNote] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const redoRef = useRef<HTMLButtonElement>(null);
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Move focus into the panel so a screen reader starts at its top, and drop a pending volume announcement on close.
  useEffect(() => {
    headingRef.current?.focus();
    return () => {
      if (volumeTimer.current !== null) clearTimeout(volumeTimer.current);
    };
  }, []);

  /** Applies a change, then says it. The saying happens after the change so it uses the new narration mode. */
  const change = (update: Partial<SettingsValues>, text: string) => {
    setSettings(update);
    setNote(text);
    void say(text);
  };

  const changeVolume = (volume: number) => {
    setSettings({ volume });
    // Dragging fires many changes; only the resting value is spoken.
    if (volumeTimer.current !== null) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(() => {
      volumeTimer.current = null;
      setNote(volumeText(volume));
      void say(volumeText(volume));
    }, STORAGE_LIMITS.volumeSpeechDebounceMs);
  };

  const changeClickSource = async (source: ClickSource) => {
    const used = await setClickSource(source);
    // setClickSource has already spoken its own failure message when it could not honour the request.
    if (used !== source) return;
    const text = used === 'mic' ? 'Clicking with the microphone. Make a tongue click.' : 'Clicking with the Space key or a tap.';
    setNote(text);
    // On the level list the mic only records once a level starts.
    if (used === 'mic' && useEcho.getState().phase === 'levelSelect') pauseMic();
    void say(text);
  };

  const ask = (kind: Exclude<Confirm, null>) => {
    setConfirm(kind);
    void say(
      kind === 'reset'
        ? 'Delete all scores on this device? Choose Yes, reset, or No, keep them.'
        : 'Redo setup? This takes you back to the start. Your scores are kept. Choose Yes, redo, or No, stay here.',
    );
  };

  const cancelConfirm = (returnTo: RefObject<HTMLButtonElement>) => {
    setConfirm(null);
    setNote('Nothing changed.');
    void say('Nothing changed.');
    // The confirm buttons vanish, so focus would otherwise fall to the page.
    requestAnimationFrame(() => returnTo.current?.focus());
  };

  const doReset = () => {
    abortRun();
    resetProgress();
    const st = useEcho.getState();
    // The echo speed was earned through scores, so it starts over with them.
    st.setSettings({ stretch: DEFAULT_STRETCH });
    // A run in progress would sit frozen after the abort, so go back to the level list.
    st.patch({
      stretchOffer: null,
      progressVersion: st.progressVersion + 1,
      phase: 'levelSelect',
      levelId: null,
      trial: null,
      lessonId: null,
      lessonPage: 0,
      lastHits: [],
      lastPose: null,
    });
    setConfirm(null);
    const text = `Progress reset. All scores are deleted. Echo speed is back to ${stretchWords(DEFAULT_STRETCH)}.`;
    onClose();
    void (async () => {
      await say(text);
      if (useEcho.getState().phase === 'levelSelect') await say(levelSelectPrompt(), { display: LEVEL_LIST_HEADING });
    })();
  };

  const doRedo = () => {
    // Stop anything still sounding or listening before the setup screens take over.
    abortRun();
    void setClickSource('key');
    setOnboarded(false);
    patch({ phase: 'onboarding', levelId: null, trial: null, stretchOffer: null, message: START_PROMPT });
    onClose();
    void say(START_PROMPT);
  };

  return (
    <section className="settings" aria-label="Settings">
      <h2 ref={headingRef} tabIndex={-1}>
        Settings
      </h2>

      <label>
        Echo speed
        <select
          value={settings.stretch}
          onChange={(e) => {
            const stretch = Number(e.target.value);
            change({ stretch }, `Echo speed: ${stretchWords(stretch)}.`);
          }}
        >
          {STRETCH_STEPS.map((s) => (
            <option key={s} value={s}>
              {stretchWords(s)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Narration
        <select
          value={settings.narration}
          disabled={screenReaderOn}
          onChange={(e) => {
            const narration = e.target.value as Narration;
            change({ narration }, narration === 'voice' ? 'Narration: Echo speaks to you.' : 'Narration: your screen reader.');
          }}
        >
          <option value="voice">Spoken voice</option>
          <option value="screenreader">My screen reader</option>
        </select>
      </label>
      {screenReaderOn && <p>Your phone's screen reader is on, so Echo uses it for narration.</p>}

      <label>
        Morse code feedback
        <select
          value={settings.morse}
          onChange={(e) => {
            const morse = e.target.value as SettingsValues['morse'];
            const names = { off: 'off', vibration: 'vibration', sound: 'beeps' } as const;
            change({ morse }, `Morse code feedback: ${names[morse]}.`);
          }}
        >
          <option value="off">Off</option>
          <option value="vibration">Vibration</option>
          <option value="sound">Beeps</option>
        </select>
      </label>

      <label>
        Feel the answer
        <select
          value={settings.haptics ? 'on' : 'off'}
          onChange={(e) => {
            const haptics = e.target.value === 'on';
            change({ haptics }, haptics ? 'Feel the answer: on.' : 'Feel the answer: off.');
          }}
        >
          <option value="off">Off</option>
          <option value="on">Vibrate for each answer and result</option>
        </select>
      </label>

      {isNative() && (
        <label>
          Volume buttons
          <select
            value={settings.volumeKeys ? 'actions' : 'system'}
            onChange={(e) => {
              const volumeKeys = e.target.value === 'actions';
              change({ volumeKeys }, volumeKeys ? 'Volume buttons: up clicks. Down replays, or moves on after an answer.' : 'Volume buttons: they change the phone volume.');
            }}
          >
            <option value="actions">Up clicks. Down replays, or moves on after an answer.</option>
            <option value="system">Change the phone volume</option>
          </select>
        </label>
      )}

      <label>
        Click source
        <select value={settings.clickSource} onChange={(e) => void changeClickSource(e.target.value as ClickSource)}>
          <option value="key">Space key or tap</option>
          <option value="mic">My tongue click (microphone)</option>
        </select>
      </label>
      <p>{micOn ? 'Mic on, with phone sound filters off.' : settings.clickSource === 'mic' ? 'Mic is on while you practise.' : 'Mic off.'}</p>

      <label>
        Volume {spokenNumber(Math.round(settings.volume * 100))} percent
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          aria-valuetext={`${spokenNumber(Math.round(settings.volume * 100))} percent`}
          onChange={(e) => changeVolume(Number(e.target.value))}
        />
      </label>

      <div className="settings-actions">
        {confirm === null && (
          <>
            <button type="button" ref={redoRef} onClick={() => ask('redo')}>
              Redo setup
            </button>
            <button type="button" ref={resetRef} onClick={() => ask('reset')}>
              Reset progress
            </button>
          </>
        )}
        {confirm === 'reset' && (
          <>
            <p>Delete all scores on this device?</p>
            <button type="button" onClick={doReset} autoFocus>
              Yes, reset
            </button>
            <button type="button" onClick={() => cancelConfirm(resetRef)}>
              No, keep them
            </button>
          </>
        )}
        {confirm === 'redo' && (
          <>
            <p>Go back to the start of setup? Your scores are kept.</p>
            <button type="button" onClick={doRedo} autoFocus>
              Yes, redo
            </button>
            <button type="button" onClick={() => cancelConfirm(redoRef)}>
              No, stay here
            </button>
          </>
        )}
        <button type="button" onClick={onClose}>
          Close settings
        </button>
      </div>
      <p>{note}</p>
    </section>
  );
}

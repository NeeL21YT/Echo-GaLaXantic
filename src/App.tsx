import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from './audio/context';
import { isPlaying, setVolume } from './audio/player';
import { attachKeyboard } from './input/keyboard';
import { cancel as cancelSpeech, initNarrator, speak } from './speech/narrator';
import { saveSettings } from './state/progress';
import { Announcer } from './speech/Announcer';
import { dispatch, say, startLevel, validActions } from './state/runner';
import { useEcho, type Action } from './state/store';
import { BlindView } from './ui/BlindView';
import { Controls } from './ui/Controls';
import { DevAudio } from './ui/DevAudio';
import { LevelSelect } from './ui/LevelSelect';
import { ObserverView } from './ui/ObserverView';
import { Onboarding } from './ui/Onboarding';
import { ProgressPanel } from './ui/ProgressPanel';
import { Settings } from './ui/Settings';
import { buttonSpeechLabel, levelSelectPrompt } from './ui/labels';

const isDevAudio = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'audio';

// Levels 1–3 are judged by ear, so the observer hides the room until the trial is answered.
const HIDDEN_UNTIL_ANSWERED = new Set([1, 2, 3]);

function useActionLabels(): Partial<Record<Action, string>> {
  const phase = useEcho((s) => s.phase);
  if (phase === 'intro') return { answer: 'Begin' };
  if (phase === 'ready') return { answer: 'Facing the door' };
  if (phase === 'summary') return { next: 'Level list' };
  return {};
}

export function App() {
  const practiceRef = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const phase = useEcho((s) => s.phase);
  const levelId = useEcho((s) => s.levelId);
  const observer = useEcho((s) => s.settings.observer);
  const trial = useEcho((s) => s.trial);
  const pose = useEcho((s) => s.pose);
  const lastHits = useEcho((s) => s.lastHits);
  const lastPose = useEcho((s) => s.lastPose);
  const shotId = useEcho((s) => s.shotId);
  const clicks = useEcho((s) => s.clicksThisTrial);
  // Subscribing to these re-renders Controls when the valid actions change.
  useEcho((s) => s.lastResult);
  useEcho((s) => s.stretchOffer);
  const labels = useActionLabels();

  const onAction = (a: Action): boolean => {
    if (a === 'settings') {
      setSettingsOpen((o) => !o);
      return true;
    }
    return dispatch(a);
  };
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  useEffect(() => {
    const el = practiceRef.current;
    if (!el) return;
    return attachKeyboard(el, () => useEcho.getState().phase, (command) => {
      if (command.type === 'action') return onActionRef.current(command.action);
      if (command.type === 'level') {
        void startLevel(command.levelId);
        return true;
      }
      return false;
    });
  }, []);

  // Returning users skip the Start button, so audio and speech unlock on their first gesture instead.
  useEffect(() => {
    const el = practiceRef.current;
    if (!el) return;
    let unlocked = false;
    const unlock = (event: Event) => {
      if (unlocked || (event instanceof KeyboardEvent && event.repeat)) return;
      unlocked = true;
      void unlockAudio();
      initNarrator();
      if (useEcho.getState().phase === 'levelSelect') {
        // The first Tab also focuses a button; let its focus label happen before the full instructions.
        requestAnimationFrame(() => {
          if (useEcho.getState().phase === 'levelSelect') void say(levelSelectPrompt());
        });
      }
    };
    // Capture runs before shortcuts can change phase, and one guard covers both gesture types.
    el.addEventListener('pointerdown', unlock, true);
    el.addEventListener('keydown', unlock, true);
    return () => {
      el.removeEventListener('pointerdown', unlock, true);
      el.removeEventListener('keydown', unlock, true);
    };
  }, []);

  useEffect(() => {
    const el = practiceRef.current;
    if (!el) return;
    const onFocus = (event: FocusEvent) => {
      const button = event.target;
      if (!(button instanceof HTMLButtonElement) || !button.matches(':focus-visible')) return;
      if (useEcho.getState().settings.narration !== 'voice' || isPlaying()) return;
      const label = button.getAttribute('aria-label') ?? button.textContent ?? '';
      cancelSpeech();
      void speak(buttonSpeechLabel(label));
    };
    el.addEventListener('focusin', onFocus);
    return () => el.removeEventListener('focusin', onFocus);
  }, []);

  // Persist settings and apply side effects; switching to screen-reader mode silences our own voice at once.
  useEffect(() => {
    setVolume(useEcho.getState().settings.volume);
    return useEcho.subscribe((s, prev) => {
      if (s.settings === prev.settings) return;
      saveSettings(s.settings);
      if (s.settings.volume !== prev.settings.volume) setVolume(s.settings.volume);
      if (s.settings.narration !== prev.settings.narration) cancelSpeech();
    });
  }, []);

  // Keys only work while the practice area has focus, so return focus to it on every phase change.
  useEffect(() => {
    if (phase !== 'onboarding') practiceRef.current?.focus();
    setReveal(false);
  }, [phase]);

  if (isDevAudio) return <DevAudio />;

  const actions = phase === 'onboarding' ? [] : [...validActions(), 'settings' as const];
  const answerActions: Action[] = ['left', 'right', 'near', 'far', 'answer'];
  const disabled = phase === 'ready' && clicks < 1 ? answerActions : [];
  const hideWorld =
    levelId !== null && HIDDEN_UNTIL_ANSWERED.has(levelId) && phase === 'ready' && !reveal;

  return (
    <div className={observer ? 'layout split' : 'layout'}>
      <div
        ref={practiceRef}
        className="practice"
        role="application"
        aria-label="Echo practice area. Press H for help."
        tabIndex={0}
      >
        <BlindView />
        {phase === 'onboarding' && <Onboarding practiceRef={practiceRef} />}
        {phase === 'levelSelect' && <LevelSelect />}
        {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
        <Controls actions={actions} onAction={onAction} disabled={disabled} labels={labels} />
        {phase === 'levelSelect' && <ProgressPanel />}
      </div>
      {observer && (
        <div className="observer-panel">
          <ObserverView
            world={trial?.world ?? null}
            pose={pose}
            hits={lastHits}
            rayPose={lastPose}
            shotId={shotId}
            hideWorld={hideWorld}
          />
          {levelId !== null && HIDDEN_UNTIL_ANSWERED.has(levelId) && phase === 'ready' && (
            <button type="button" className="reveal" onClick={() => setReveal((r) => !r)} aria-pressed={reveal}>
              {reveal ? 'Hide room' : 'Reveal room'}
            </button>
          )}
        </div>
      )}
      <Announcer />
    </div>
  );
}

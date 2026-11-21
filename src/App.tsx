import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from './audio/context';
import { setVolume } from './audio/player';
import { attachGestures } from './input/gestures';
import { phrases } from './input/inputStyle';
import { attachKeyboard } from './input/keyboard';
import { actionForVolumeKey } from './input/volumeKeys';
import { captureVolumeKeys, isScreenReaderOn, onScreenReaderChange, onVolumeKey, vibrate } from './native/echoNative';
import { GESTURE } from './config';
import { cancel as cancelSpeech, initNarrator } from './speech/narrator';
import { saveSettings } from './state/progress';
import { Announcer } from './speech/Announcer';
import { lessonAction, lessonActions } from './state/lessonRunner';
import { roomAction, roomActions } from './state/roomRunner';
import { dispatch, validActions } from './state/runner';
import { useEcho, type Action } from './state/store';
import { BlindView } from './ui/BlindView';
import { Controls } from './ui/Controls';
import { DevAudio } from './ui/DevAudio';
import { LevelSelect } from './ui/LevelSelect';
import { ObserverView } from './ui/ObserverView';
import { Onboarding } from './ui/Onboarding';
import { ProgressPanel } from './ui/ProgressPanel';
import { Settings } from './ui/Settings';

const isDevAudio = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'audio';

// Levels 1–3 are judged by ear, so the observer hides the room until the trial is answered.
const HIDDEN_UNTIL_ANSWERED = new Set([1, 2, 3]);

function useActionLabels(): Partial<Record<Action, string>> {
  const phase = useEcho((s) => s.phase);
  if (phase === 'intro') return { answer: 'Begin' };
  if (phase === 'ready') return { answer: 'Facing the door' };
  if (phase === 'summary') return { next: 'Level list' };
  if (phase === 'lesson') return { next: 'Continue', replay: 'Hear again', answer: 'Practise this skill' };
  if (phase === 'realRoom') return { far: 'Farther', near: 'Closer', answer: 'Lock in my guess', replay: 'Tell me the distance', next: 'Try again', click: 'Click (ping)' };
  return {};
}

/** The actions valid right now, whichever flow owns the screen. */
function currentActions(phase: string): Action[] {
  if (phase === 'lesson') return lessonActions();
  if (phase === 'realRoom') return roomActions();
  return validActions();
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
  useEcho((s) => s.lessonPage);
  useEcho((s) => s.roomStep);
  const labels = useActionLabels();

  const onAction = (a: Action): boolean => {
    if (a === 'settings') {
      setSettingsOpen((o) => !o);
      return true;
    }
    if (phase === 'lesson') return lessonAction(a);
    if (phase === 'realRoom') return roomAction(a);
    return dispatch(a);
  };
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  useEffect(() => {
    const el = practiceRef.current;
    if (!el) return;
    return attachKeyboard(el, (a) => onActionRef.current(a));
  }, []);

  // Returning users skip the Start button, so audio and speech unlock on their first gesture instead.
  useEffect(() => {
    const el = practiceRef.current;
    if (!el) return;
    const unlock = () => {
      void unlockAudio();
      initNarrator();
    };
    el.addEventListener('pointerdown', unlock, { once: true });
    el.addEventListener('keydown', unlock, { once: true });
    return () => {
      el.removeEventListener('pointerdown', unlock);
      el.removeEventListener('keydown', unlock);
    };
  }, []);

  const screenReaderOn = useEcho((s) => s.screenReaderOn);
  const volumeKeys = useEcho((s) => s.settings.volumeKeys);

  // Touch gestures (§13.2). With a screen reader on, the OS keeps raw touch, so the real buttons are the way in.
  useEffect(() => {
    const el = practiceRef.current;
    if (!el || screenReaderOn) return;
    const valid = () => currentActions(useEcho.getState().phase);
    return attachGestures(el, (a) => onActionRef.current(a), valid, () => void vibrate([GESTURE.tickMs]));
  }, [screenReaderOn]);

  // Volume keys (§13.3), native only: keys act as Click and Replay unless a screen reader needs them for its own volume.
  useEffect(() => {
    const capture = volumeKeys && !screenReaderOn;
    void captureVolumeKeys(capture);
    if (!capture) return;
    return onVolumeKey((key) => {
      const st = useEcho.getState();
      const valid = currentActions(st.phase);
      const action = actionForVolumeKey(key, valid, st.phase === 'ready');
      if (action) onActionRef.current(action);
    });
  }, [volumeKeys, screenReaderOn]);

  // Device screen reader (§13.5): when TalkBack is on, our backup voice stays silent and the screen reader narrates.
  useEffect(() => {
    let before: 'voice' | 'screenreader' | null = null;
    const apply = (on: boolean) => {
      const st = useEcho.getState();
      if (on === st.screenReaderOn) return;
      st.patch({ screenReaderOn: on });
      if (on) {
        before = st.settings.narration;
        st.setSettings({ narration: 'screenreader' });
      } else if (before !== null) {
        st.setSettings({ narration: before });
        before = null;
      }
    };
    void isScreenReaderOn().then(apply);
    const off = onScreenReaderChange(apply);
    const recheck = () => {
      if (!document.hidden) void isScreenReaderOn().then(apply);
    };
    document.addEventListener('visibilitychange', recheck);
    return () => {
      off();
      document.removeEventListener('visibilitychange', recheck);
    };
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

  const baseActions = currentActions(phase);
  const actions = phase === 'onboarding' ? [] : [...baseActions, 'settings' as const];
  const answerActions: Action[] = ['left', 'right', 'near', 'far', 'answer'];
  const disabled = phase === 'ready' && clicks < 1 ? answerActions : [];
  const hideWorld =
    levelId !== null && HIDDEN_UNTIL_ANSWERED.has(levelId) && phase === 'ready' && !reveal;

  const gestureSurface = !screenReaderOn && !settingsOpen && phase !== 'onboarding' && phase !== 'levelSelect';

  return (
    <div className={observer ? 'layout split' : 'layout'}>
      <div
        ref={practiceRef}
        className={gestureSurface ? 'practice gesture-surface' : 'practice'}
        role="application"
        aria-label={phrases().areaLabel}
        tabIndex={0}
      >
        <BlindView />
        {phase === 'onboarding' && <Onboarding />}
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

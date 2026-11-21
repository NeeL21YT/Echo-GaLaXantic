import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from './audio/context';
import { isAudioUnlocked } from './audio/context';
import { stop as stopMic } from './audio/micDetector';
import { isPlaying, setVolume, stopAll } from './audio/player';
import { backStep, EXIT_CONFIRM_MS } from './input/back';
import { attachGestures, gestureActions } from './input/gestures';
import { phrases } from './input/inputStyle';
import { attachReadAloud } from './input/readAloud';
import { attachKeyboard } from './input/keyboard';
import { scanMenu } from './input/menuScan';
import { actionForVolumeKey, createVolumeKeyGuard } from './input/volumeKeys';
import { cancelVibration, captureVolumeKeys, exitApp, isNative, isScreenReaderOn, micPermissionGranted, onBackPressed, openAppSettings, onScreenReaderChange, onVolumeKey, vibrate } from './native/echoNative';
import { GESTURE, VOLUME_KEY } from './config';
import { cancel as cancelSpeech, initNarrator, isSpeaking, speak } from './speech/narrator';
import { saveSettings } from './state/progress';
import { Announcer } from './speech/Announcer';
import { lessonAction, lessonActions } from './state/lessonRunner';
import { roomAction, roomActions } from './state/roomRunner';
import { dispatch, say, setClickSource, startLevel, validActions } from './state/runner';
import { useEcho, type Action } from './state/store';
import { BlindView } from './ui/BlindView';
import { Controls } from './ui/Controls';
import { DevAudio } from './ui/DevAudio';
import { LevelSelect } from './ui/LevelSelect';
import { ObserverView } from './ui/ObserverView';
import { Onboarding } from './ui/Onboarding';
import { ProgressPanel } from './ui/ProgressPanel';
import { Settings } from './ui/Settings';
import { buttonSpeechLabel, LEVEL_LIST_HEADING, levelSelectPrompt } from './ui/labels';

const IGNORED_GESTURE_HINT = 'That gesture does nothing here. Tap with two fingers for help.';

const isDevAudio = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'audio';

// Levels 1–3 are judged by ear, so the observer hides the room until the trial is answered.
const HIDDEN_UNTIL_ANSWERED = new Set([1, 2, 3]);

function useActionLabels(): Partial<Record<Action, string>> {
  const phase = useEcho((s) => s.phase);
  if (phase === 'intro') return { answer: 'Begin' };
  if (phase === 'ready') return { answer: 'Facing the door' };
  if (phase === 'summary') return { next: 'Level list' };
  if (phase === 'lesson') return { next: 'Continue', replay: 'Hear again', answer: 'Practise this skill' };
  if (phase === 'realRoom') return { far: 'Far', near: 'Near', answer: 'Lock in my guess', replay: 'Tell me the distance', next: 'Next', click: 'Click (ping)' };
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
  const settingsOpenRef = useRef(false);
  settingsOpenRef.current = settingsOpen;
  const phase = useEcho((s) => s.phase);
  const levelId = useEcho((s) => s.levelId);
  const observer = useEcho((s) => s.settings.observer);
  const trial = useEcho((s) => s.trial);
  const pose = useEcho((s) => s.pose);
  const lastHits = useEcho((s) => s.lastHits);
  const lastPose = useEcho((s) => s.lastPose);
  const shotId = useEcho((s) => s.shotId);
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
    // Read the phase now, not from the render this closure was made in: a key can arrive before React re-renders.
    const now = useEcho.getState().phase;
    // Settings sits on top of the screen; nothing underneath may act while it is open, except Escape to close it.
    if (settingsOpenRef.current) {
      if (a !== 'levelSelect') return false;
      setSettingsOpen(false);
      return true;
    }
    if (now === 'lesson') return lessonAction(a);
    if (now === 'realRoom') return roomAction(a);
    return dispatch(a);
  };
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  // Back (§13.11): the on-screen button, the phone's back button and its back swipe all do the same one-step-up.
  const exitArmedAt = useRef(0);
  const goBack = () => {
    const step = backStep(useEcho.getState().phase, settingsOpenRef.current);
    if (step === 'closeSettings') {
      setSettingsOpen(false);
      return;
    }
    if (step === 'levelList') {
      onActionRef.current('levelSelect');
      return;
    }
    // The top screen: closing the app takes two presses so it can never happen by accident.
    const now = Date.now();
    if (now - exitArmedAt.current < EXIT_CONFIRM_MS) {
      void exitApp();
      return;
    }
    exitArmedAt.current = now;
    void say('Press back again to close Echo.');
  };
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  useEffect(() => onBackPressed(() => goBackRef.current()), []);

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
      unlockAudio().catch(() => undefined);
      initNarrator();
      if (!launchPromptSpoken.current && useEcho.getState().phase === 'levelSelect') {
        launchPromptSpoken.current = true;
        // The first Tab also focuses a button; let its focus label happen before the full instructions.
        requestAnimationFrame(() => {
          if (useEcho.getState().phase === 'levelSelect') void say(levelSelectPrompt(), { display: LEVEL_LIST_HEADING });
        });
      }
    };
    // A touch only counts as a user gesture once it lifts, so pointerdown alone may leave audio suspended on Android.
    // Keep trying on lift and click until the context is running.
    const ensureAudio = () => {
      if (!isAudioUnlocked()) unlockAudio().catch(() => undefined);
    };
    // Capture runs before shortcuts can change phase, and one guard covers both gesture types.
    el.addEventListener('pointerdown', unlock, true);
    el.addEventListener('keydown', unlock, true);
    el.addEventListener('pointerup', ensureAudio, true);
    el.addEventListener('click', ensureAudio, true);
    return () => {
      el.removeEventListener('pointerdown', unlock, true);
      el.removeEventListener('keydown', unlock, true);
      el.removeEventListener('pointerup', ensureAudio, true);
      el.removeEventListener('click', ensureAudio, true);
    };
  }, []);

  const screenReaderOn = useEcho((s) => s.screenReaderOn);
  // The narration chosen before TalkBack forced screen-reader mode; that, not the forced value, is what gets saved.
  const narrationBefore = useRef<'voice' | 'screenreader' | null>(null);
  const volumeKeys = useEcho((s) => s.settings.volumeKeys);
  const inOnboarding = phase === 'onboarding';
  // True once the level-list prompt has been spoken at launch, so the first gesture does not repeat it.
  const launchPromptSpoken = useRef(false);
  // Set when the app is hidden while the microphone is listening, so it can listen again on return.
  const micWasOn = useRef(false);

  // Touch gestures (§13.2). With a screen reader on, the OS keeps raw touch, so the real buttons are the way in.
  useEffect(() => {
    const el = practiceRef.current;
    if (!el || screenReaderOn) return;
    const valid = () => {
      const phaseNow = useEcho.getState().phase;
      return settingsOpenRef.current ? [] : gestureActions(phaseNow, currentActions(phaseNow));
    };
    const readsAloud = () => {
      const st = useEcho.getState();
      return !st.screenReaderOn && st.settings.narration === 'voice';
    };
    // Voice mode only, and never over other sound or on the screens where stray taps are expected.
    let lastHintAt = -Infinity;
    const hint = () => {
      const st = useEcho.getState();
      if (!readsAloud() || settingsOpenRef.current || st.phase === 'onboarding' || st.phase === 'levelSelect') return;
      const now = Date.now();
      if (now - lastHintAt < GESTURE.ignoredHintGapMs || isPlaying() || isSpeaking()) return;
      lastHintAt = now;
      void say(IGNORED_GESTURE_HINT);
    };
    return attachGestures(el, (a) => onActionRef.current(a), valid, () => void vibrate([GESTURE.tickMs]), readsAloud, hint);
  }, [screenReaderOn]);

  // Touch-and-hold reads a control aloud (§13.2). Only with our own voice: a screen reader already does this itself.
  useEffect(() => {
    const el = practiceRef.current;
    if (!el) return;
    return attachReadAloud(el, {
      enabled: () => {
        const st = useEcho.getState();
        return !st.screenReaderOn && st.settings.narration === 'voice';
      },
      speak: (text) => {
        cancelSpeech();
        void speak(text);
      },
      onRead: () => void vibrate([GESTURE.tickMs]),
    });
  }, []);

  // Volume keys (§13.3), native only: keys act as Click and Replay unless a screen reader needs them for its own volume.
  useEffect(() => {
    // Setup needs the phone's own volume for the headphone check, so the keys are released until it is done.
    const capture = volumeKeys && !screenReaderOn && !inOnboarding;
    void captureVolumeKeys(capture);
    if (!capture) return;
    const allowed = createVolumeKeyGuard(VOLUME_KEY.repeatGuardMs);
    return onVolumeKey((key) => {
      if (!allowed(key)) return;
      // Settings is on top; the keys stay out of the way there.
      if (settingsOpenRef.current) return;
      const st = useEcho.getState();
      // On the level list there are no practice actions, so the keys scan the menu instead (§13.3).
      if (st.phase === 'levelSelect') {
        scanMenu(key, (text) => {
          if (st.settings.narration === 'voice') {
            cancelSpeech();
            void speak(text);
          } else {
            void say(text);
          }
        });
        return;
      }
      const valid = currentActions(st.phase);
      const action = actionForVolumeKey(key, valid, st.phase);
      if (action) onActionRef.current(action);
    });
  }, [volumeKeys, screenReaderOn, inOnboarding]);

  // Device screen reader (§13.5): when TalkBack is on, our backup voice stays silent and the screen reader narrates.
  useEffect(() => {
    const apply = (on: boolean) => {
      const st = useEcho.getState();
      if (on === st.screenReaderOn) return;
      st.patch({ screenReaderOn: on });
      if (on) {
        // On the phone 'screenreader' without TalkBack is silence, so never restore it.
        narrationBefore.current = isNative() && st.settings.narration === 'screenreader' ? 'voice' : st.settings.narration;
        st.setSettings({ narration: 'screenreader' });
      } else if (narrationBefore.current !== null) {
        st.setSettings({ narration: narrationBefore.current });
        narrationBefore.current = null;
      }
    };
    // An older build saved the screen-reader value TalkBack forced. With TalkBack off that would leave Echo silent,
    // so on the phone the first check turns such a saved value back into the spoken voice.
    void isScreenReaderOn().then((on) => {
      const st = useEcho.getState();
      if (!on && isNative() && st.settings.narration === 'screenreader') st.setSettings({ narration: 'voice' });
      apply(on);
    });
    const off = onScreenReaderChange(apply);
    // The runner owns jobs, the Escape clock and repeating the message on return. This handler only adds what it
    // does not: vibration, the microphone, the screen-reader recheck, and a silence for screens the runner skips.
    // Neither speaks on hide, and the mic restart speaks only if it fails, so nothing overlaps.
    const onVisibility = () => {
      if (document.hidden) {
        cancelSpeech();
        stopAll();
        void cancelVibration();
        if (useEcho.getState().micOn) {
          micWasOn.current = true;
          stopMic();
          useEcho.getState().patch({ micOn: false });
        }
        return;
      }
      void isScreenReaderOn().then(apply);
      if (micWasOn.current) {
        micWasOn.current = false;
        // Asks Android for the microphone again, so a permission revoked meanwhile falls back to the Space key.
        void setClickSource('mic');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Native speech needs no gesture, so a returning user hears the level list at launch (unless TalkBack is on).
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    void isScreenReaderOn().then((on) => {
      const st = useEcho.getState();
      if (cancelled || on || launchPromptSpoken.current || st.phase !== 'levelSelect') return;
      launchPromptSpoken.current = true;
      void say(levelSelectPrompt(), { display: LEVEL_LIST_HEADING });
    });
    return () => {
      cancelled = true;
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
      // A narration change made by the user while TalkBack is on replaces the remembered choice.
      if (s.screenReaderOn && narrationBefore.current !== null && s.settings.narration !== prev.settings.narration && s.settings.narration !== 'screenreader') {
        narrationBefore.current = s.settings.narration;
      }
      const remembered = s.screenReaderOn ? narrationBefore.current : null;
      saveSettings(remembered ? { ...s.settings, narration: remembered } : s.settings);
      if (s.settings.volume !== prev.settings.volume) setVolume(s.settings.volume);
      if (s.settings.narration !== prev.settings.narration) cancelSpeech();
    });
  }, []);

  useEffect(() => {
    // The runner's mic gate reads this flag.
    useEcho.getState().patch({ settingsOpen });
    if (!settingsOpen) practiceRef.current?.focus();
  }, [settingsOpen]);

  // Keys only work while the practice area has focus, so return focus to it on every phase change.
  useEffect(() => {
    if (phase !== 'onboarding') practiceRef.current?.focus();
    setReveal(false);
  }, [phase]);

  const micBlocked = useEcho((s) => s.micBlocked);
  // Coming back from the phone's settings page: clear the notice if the microphone is now allowed.
  useEffect(() => {
    if (!micBlocked) return;
    const recheck = () => {
      if (!document.hidden) void micPermissionGranted().then((ok) => ok && useEcho.getState().patch({ micBlocked: false }));
    };
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, [micBlocked]);

  if (isDevAudio) return <DevAudio />;

  const baseActions = currentActions(phase);
  const actions: Action[] = phase === 'onboarding' ? [] : settingsOpen ? ['settings'] : [...baseActions, 'settings'];
  const hideWorld =
    levelId !== null && HIDDEN_UNTIL_ANSWERED.has(levelId) && phase === 'ready' && !reveal;

  const showBack = settingsOpen || (phase !== 'levelSelect' && phase !== 'onboarding');
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
        {showBack && (
          <header className="topbar">
            <button type="button" className="back" onClick={goBack} aria-label={settingsOpen ? 'Back. Close settings.' : 'Back to the level list.'}>
              <span aria-hidden="true">‹</span> Back
            </button>
          </header>
        )}
        <BlindView />
        {phase === 'onboarding' && <Onboarding practiceRef={practiceRef} />}
        {phase === 'levelSelect' && <LevelSelect />}
        {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
        {micBlocked && (
          <div className="mic-blocked">
            <button type="button" onClick={() => void openAppSettings()}>
              Open settings
            </button>
          </div>
        )}
        <Controls actions={actions} onAction={onAction} labels={labels} />
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

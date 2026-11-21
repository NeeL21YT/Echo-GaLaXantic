// First-run setup (§9.5): Start → screen-reader question → headphone check → optional mic → level list.
// The screen-reader question comes before the headphone check so speech never talks over a screen reader
// (see the CLAUDE.md Decisions log). Every instruction is worded for how the learner controls Echo (keys, touch or
// buttons), and every step that is left stops its own speech, tone and microphone request.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { GESTURE, ONBOARDING } from '../config';
import { closeRanger } from '../audio/ranger';
import { unlockAudio } from '../audio/context';
import { stopAll } from '../audio/player';
import { lrTest } from '../audio/sfx';
import { attachGestures } from '../input/gestures';
import { currentInputStyle, phrases } from '../input/inputStyle';
import { attachKeyboard } from '../input/keyboard';
import { spokenNumber } from '../levels/feedback';
import { isNative, vibrate } from '../native/echoNative';
import { cancel, initNarrator, speak } from '../speech/narrator';
import {
  headphonesHelp, headphonesIntro, headphonesReversed, micAsking, MIC_TEST_QUIET, micQuestion, micTestHeard, micTestPrompt,
  narrationQuestion, SCREEN_READER_DETECTED, setupLabels,
} from '../speech/setupText';
import { abortTeaching } from '../state/lessonRunner';
import { setOnboarded } from '../state/progress';
import { abortRoom } from '../state/roomRunner';
import { goToLevelSelect, say, setClickSource } from '../state/runner';
import { sayAndSettle, settleMicRefusal } from '../state/settle';
import { useEcho, type Action } from '../state/store';
import type { OnboardingAction, OnboardingStep } from '../types';
import { START_PROMPT } from './labels';

type Side = 'left' | 'right';

/** Touch gestures on the setup screens, translated to the setup's own actions. */
const GESTURE_ACTIONS: Partial<Record<OnboardingStep, Partial<Record<Action, OnboardingAction>>>> = {
  narration: { answer: 'voice', far: 'screenreader' },
  headphones: { left: 'left', right: 'right' },
  mic: { answer: 'skipMic', far: 'enableMic' },
  micTest: { answer: 'done' },
};

export function Onboarding({ practiceRef }: { practiceRef: RefObject<HTMLDivElement> }) {
  const [step, setStep] = useState<OnboardingStep>('start');
  const stepRef = useRef(step);
  const starting = useRef(false);
  const sideRef = useRef<Side>('left');
  const missesRef = useRef(0);
  const micBusy = useRef(false);
  /** Sentence spoken in front of the next step's own prompt, so one message never cuts off another. */
  const leadRef = useRef('');
  /** Bumped by every step change and every tone, so speech or sound from a step that was left stops itself. */
  const flow = useRef(0);
  const [micBaseline, setMicBaseline] = useState(0);
  const setSettings = useEcho((s) => s.setSettings);
  const screenReaderOn = useEcho((s) => s.screenReaderOn);
  const labels = setupLabels(currentInputStyle());

  const changeStep = (next: OnboardingStep, lead = '') => {
    flow.current += 1;
    leadRef.current = lead;
    stepRef.current = next;
    setStep(next);
  };

  const playSide = async (s: Side, lead = '') => {
    sideRef.current = s;
    const job = ++flow.current;
    const alive = () => job === flow.current;
    const help = headphonesHelp(currentInputStyle());
    await sayAndSettle(`${lead} ${phrases().tone(s)} ${help}`.replace(/\s+/g, ' ').trim(), alive);
    if (!alive()) return;
    cancel();
    if (!alive()) return;
    await lrTest(s);
  };

  const start = () => {
    // Pointerdown and the button's native click can be part of the same gesture.
    if (starting.current || stepRef.current !== 'start') return;
    starting.current = true;
    // Not awaited: on a touch screen the context may only resume once the finger lifts, and waiting here would stall setup.
    unlockAudio().catch(() => undefined);
    initNarrator();
    // The phone's own screen reader is already on: asking would only let the answer start a second voice over it.
    if (useEcho.getState().screenReaderOn) changeStep('headphones', SCREEN_READER_DETECTED);
    else changeStep('narration');
  };

  const chooseNarration = (screenReader: boolean) => {
    if (stepRef.current !== 'narration') return;
    // With the device's screen reader on, our voice stays off whatever is answered.
    if (!useEcho.getState().screenReaderOn) setSettings({ narration: screenReader ? 'screenreader' : 'voice' });
    changeStep('headphones');
  };

  const answerSide = async (heard: Side) => {
    if (stepRef.current !== 'headphones') return;
    const side = sideRef.current;
    if (heard !== side) {
      missesRef.current += 1;
      if (missesRef.current >= ONBOARDING.headphoneMisses) return changeStep('mic', headphonesReversed());
      return playSide(side, `Not quite. The tone was on the ${side}. Listen again.`);
    }
    if (side === 'left') return playSide('right', 'Good.');
    changeStep('mic', 'Your headphones work.');
  };

  const finish = async (leaveMicOff: boolean) => {
    flow.current += 1;
    // Redoing setup with the microphone already on and choosing Skip must really turn it off.
    if (leaveMicOff) await setClickSource('key');
    setOnboarded(true);
    await goToLevelSelect();
  };

  const enableMic = async () => {
    if (stepRef.current !== 'mic' || micBusy.current) return;
    micBusy.current = true;
    const job = flow.current;
    const alive = () => job === flow.current;
    try {
      await sayAndSettle(micAsking(), alive);
      if (!alive()) return;
      // The detector reports each click here instead of to the runner while we test it.
      const source = await setClickSource('mic');
      if (!alive()) {
        // Skipped while the permission prompt was open.
        if (source === 'mic') await setClickSource('key');
        return;
      }
      if (source !== 'mic') {
        // The runner has just said why; let it finish, then carry on without the microphone.
        await settleMicRefusal(alive);
        if (alive()) await finish(false);
        return;
      }
      setMicBaseline(useEcho.getState().micClicks);
      changeStep('micTest');
    } finally {
      micBusy.current = false;
    }
  };

  const doneMicTest = async () => {
    const heard = useEcho.getState().micClicks - micBaseline;
    // Too few clicks means the mic is not working for this person, so it is switched off rather than left recording.
    const enough = heard >= ONBOARDING.micTestClicks;
    if (!enough) await sayAndSettle(MIC_TEST_QUIET);
    await finish(!enough);
  };

  const onAction = (action: OnboardingAction) => {
    switch (action) {
      case 'start': start(); break;
      case 'screenreader': chooseNarration(true); break;
      case 'voice': chooseNarration(false); break;
      case 'left': void answerSide('left'); break;
      case 'right': void answerSide('right'); break;
      case 'skipMic': if (stepRef.current === 'mic') void finish(true); break;
      case 'done': if (stepRef.current === 'micTest') void doneMicTest(); break;
      case 'enableMic': void enableMic(); break;
    }
  };
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  // Redoing setup from Settings can land here while a lesson, the click coach or the real-room check is running.
  useEffect(() => {
    abortTeaching();
    abortRoom();
    closeRanger();
    stopAll();
    cancel();
    return () => {
      flow.current += 1;
      stopAll();
    };
  }, []);

  useEffect(() => {
    const el = practiceRef.current;
    if (!el) return;
    const detach = attachKeyboard(el, () => stepRef.current, (command) => {
      if (command.type !== 'onboarding') return false;
      onActionRef.current(command.action);
      return true;
    });
    const onPointer = () => {
      if (stepRef.current === 'start') onActionRef.current('start');
    };
    el.addEventListener('pointerdown', onPointer);
    return () => {
      detach();
      el.removeEventListener('pointerdown', onPointer);
    };
  }, [practiceRef]);

  // Touch without a screen reader: swipes and a long press answer the setup questions (the buttons still work).
  useEffect(() => {
    const el = practiceRef.current;
    if (!el || screenReaderOn) return;
    const mapped = (a: Action): OnboardingAction | undefined => GESTURE_ACTIONS[stepRef.current]?.[a];
    const valid = () => Object.keys(GESTURE_ACTIONS[stepRef.current] ?? {}) as Action[];
    return attachGestures(
      el,
      (a) => {
        const action = mapped(a);
        if (!action) return false;
        onActionRef.current(action);
        return true;
      },
      valid,
      () => void vibrate([GESTURE.tickMs]),
      () => !useEcho.getState().screenReaderOn && useEcho.getState().settings.narration === 'voice',
    );
  }, [practiceRef, screenReaderOn]);

  // Autofocus runs first; its short label must not replace the step's instructions.
  useEffect(() => {
    const lead = leadRef.current;
    leadRef.current = '';
    const style = currentInputStyle();
    const job = ++flow.current;
    const alive = () => job === flow.current;
    const join = (text: string) => `${lead} ${text}`.trim();
    if (step === 'start') {
      // The phone's own speech needs no gesture, so a blind user hears what to do at launch. Browsers need one first.
      const activated = typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === true;
      if ((isNative() || activated) && !useEcho.getState().screenReaderOn) void say(START_PROMPT);
    } else if (step === 'narration') {
      void say(narrationQuestion(style));
    } else if (step === 'headphones') {
      void (async () => {
        await sayAndSettle(join(headphonesIntro()), alive);
        if (alive()) await playSide('left');
      })();
    } else if (step === 'mic') {
      void say(join(micQuestion(style)));
    } else if (step === 'micTest') {
      void say(micTestPrompt(style, spokenNumber(ONBOARDING.micTestClicks)));
    }
  }, [step]);

  return (
    <div className="onboarding">
      {step === 'start' && (
        <button type="button" className="start-button" onClick={() => start()} autoFocus>
          {START_PROMPT}
        </button>
      )}
      {step === 'narration' && (
        <>
          <p>Do you use a screen reader?</p>
          <button type="button" onClick={() => chooseNarration(true)}>
            {labels.yes}
          </button>
          <button type="button" onClick={() => chooseNarration(false)} autoFocus>
            {labels.no}
          </button>
        </>
      )}
      {step === 'headphones' && (
        <>
          <p>Press the button for the side where you hear the tone.</p>
          <button type="button" onClick={() => void answerSide('left')} autoFocus>
            {labels.left}
          </button>
          <button type="button" onClick={() => void answerSide('right')}>
            {labels.right}
          </button>
          <button type="button" onClick={() => void playSide(sideRef.current)}>
            Play the tone again
          </button>
          <button type="button" onClick={() => changeStep('mic', 'Skipped the headphone check.')}>
            Skip headphone check
          </button>
        </>
      )}
      {step === 'mic' && (
        <>
          <p>Use your own tongue click?</p>
          <button type="button" onClick={() => void finish(true)} autoFocus>
            {labels.skipMic}
          </button>
          <button type="button" onClick={() => void enableMic()}>
            {labels.enableMic}
          </button>
        </>
      )}
      {step === 'micTest' && <MicTest baseline={micBaseline} doneLabel={labels.done} onDone={() => void doneMicTest()} />}
    </div>
  );
}

type MicTestProps = { baseline: number; doneLabel: string; onDone: () => void };

/** Shows and speaks how many tongue clicks the detector heard since the test began. */
function MicTest({ baseline, doneLabel, onDone }: MicTestProps) {
  const heard = useEcho((s) => s.micClicks) - baseline;
  const micOn = useEcho((s) => s.micOn);
  const narration = useEcho((s) => s.settings.narration);

  useEffect(() => {
    if (heard <= 0 || narration !== 'voice') return;
    cancel();
    void speak(micTestHeard(currentInputStyle(), spokenNumber(heard), heard >= ONBOARDING.micTestClicks));
  }, [heard, narration]);

  return (
    <>
      <p aria-live="polite">
        {micOn ? `Clicks heard: ${spokenNumber(heard)} of ${spokenNumber(ONBOARDING.micTestClicks)}.` : 'Microphone is off.'}
      </p>
      <button type="button" onClick={onDone} autoFocus>
        {doneLabel}
      </button>
    </>
  );
}

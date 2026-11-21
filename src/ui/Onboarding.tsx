// First-run setup (§9.5): Start → screen-reader question → headphone check → optional mic → level list.
// The screen-reader question comes before the headphone check so speech never talks over a screen reader
// (see the CLAUDE.md Decisions log).
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ONBOARDING } from '../config';
import { unlockAudio } from '../audio/context';
import { phrases } from '../input/inputStyle';
import { lrTest } from '../audio/sfx';
import { attachKeyboard } from '../input/keyboard';
import { spokenNumber } from '../levels/feedback';
import { initNarrator, speak } from '../speech/narrator';
import { setOnboarded } from '../state/progress';
import { goToLevelSelect, say, setClickSource } from '../state/runner';
import { useEcho } from '../state/store';
import type { OnboardingAction, OnboardingStep } from '../types';
import { START_PROMPT } from './labels';

type Side = 'left' | 'right';

export function Onboarding({ practiceRef }: { practiceRef: RefObject<HTMLDivElement> }) {
  const [step, setStep] = useState<OnboardingStep>('start');
  const stepRef = useRef(step);
  const starting = useRef(false);
  const [side, setSide] = useState<Side>('left');
  const [misses, setMisses] = useState(0);
  const [micBaseline, setMicBaseline] = useState(0);
  const setSettings = useEcho((s) => s.setSettings);

  const changeStep = (next: OnboardingStep) => {
    stepRef.current = next;
    setStep(next);
  };

  const playSide = async (s: Side) => {
    setSide(s);
    await say(phrases().tone(s));
    await lrTest(s);
  };

  const start = async () => {
    // Pointerdown and the button's native click can be part of the same gesture.
    if (starting.current || stepRef.current !== 'start') return;
    starting.current = true;
    await unlockAudio();
    initNarrator();
    changeStep('narration');
  };

  const chooseNarration = (screenReader: boolean) => {
    setSettings({ narration: screenReader ? 'screenreader' : 'voice' });
    changeStep('headphones');
  };

  const answerSide = async (heard: Side) => {
    if (heard !== side) {
      const n = misses + 1;
      setMisses(n);
      if (n >= ONBOARDING.headphoneMisses) {
        await say('Your headphones may be reversed or not stereo. You can continue anyway.');
        return goToMic();
      }
      await say(`That was the ${side} side. Let's try again.`);
      return playSide(side);
    }
    if (side === 'left') return playSide('right');
    await say('Your headphones work.');
    return goToMic();
  };

  const goToMic = () => {
    changeStep('mic');
  };

  const enableMic = async () => {
    // The detector reports each click here instead of to the runner while we test it.
    const source = await setClickSource('mic');
    if (source !== 'mic') return finish();
    setMicBaseline(useEcho.getState().micClicks);
    changeStep('micTest');
  };

  const finish = async () => {
    setOnboarded(true);
    await goToLevelSelect();
  };

  const onAction = (action: OnboardingAction) => {
    switch (action) {
      case 'start': void start(); break;
      case 'screenreader': void chooseNarration(true); break;
      case 'voice': void chooseNarration(false); break;
      case 'left': void answerSide('left'); break;
      case 'right': void answerSide('right'); break;
      case 'skipMic':
      case 'done': void finish(); break;
      case 'enableMic': void enableMic(); break;
    }
  };
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

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

  // Autofocus runs first; its short label must not replace the step's instructions.
  useEffect(() => {
    if (step === 'narration') {
      void say('Welcome to Echo. Do you use a screen reader? Press Y for yes or N for no.');
    } else if (step === 'headphones') {
      void (async () => {
        await say('Headphone check. Put on your headphones.');
        await playSide('left');
      })();
    } else if (step === 'mic') {
      void say('Use your own tongue click? Press Enter or N to skip and use the Space key. Press M to use the microphone. You can turn this on later in Settings.');
    } else if (step === 'micTest') {
      void say(`Click your tongue ${spokenNumber(ONBOARDING.micTestClicks)} times. Press Enter when done.`);
    }
  }, [step]);

  return (
    <div className="onboarding">
      {step === 'start' && (
        <button type="button" className="start-button" onClick={() => void start()} autoFocus>
          {START_PROMPT}
        </button>
      )}
      {step === 'narration' && (
        <>
          <p>Do you use a screen reader?</p>
          <button type="button" onClick={() => void chooseNarration(true)}>
            Yes, I use a screen reader (Y)
          </button>
          <button type="button" onClick={() => void chooseNarration(false)} autoFocus>
            No, speak to me (N)
          </button>
        </>
      )}
      {step === 'headphones' && (
        <>
          <p>Press the button for the side where you hear the tone.</p>
          <button type="button" onClick={() => void answerSide('left')} autoFocus>
            Left (←)
          </button>
          <button type="button" onClick={() => void answerSide('right')}>
            Right (→)
          </button>
          <button type="button" onClick={() => void playSide(side)}>
            Play the tone again
          </button>
          <button type="button" onClick={() => void goToMic()}>
            Skip headphone check
          </button>
        </>
      )}
      {step === 'mic' && (
        <>
          <p>Use your own tongue click?</p>
          <button type="button" onClick={() => void finish()} autoFocus>
            Skip, use tap or the Space key (Enter or N)
          </button>
          <button type="button" onClick={() => void enableMic()}>
            Yes, use my microphone (M)
          </button>
        </>
      )}
      {step === 'micTest' && <MicTest baseline={micBaseline} onDone={() => void finish()} />}
    </div>
  );
}

type MicTestProps = { baseline: number; onDone: () => void };

/** Shows and speaks how many tongue clicks the detector heard since the test began. */
function MicTest({ baseline, onDone }: MicTestProps) {
  const heard = useEcho((s) => s.micClicks) - baseline;
  const micOn = useEcho((s) => s.micOn);
  const narration = useEcho((s) => s.settings.narration);

  useEffect(() => {
    if (heard <= 0) return;
    const text = heard >= ONBOARDING.micTestClicks
      ? `${spokenNumber(heard)} clicks heard. The microphone works. Press Enter when done.`
      : `${spokenNumber(heard)} clicks heard so far.`;
    if (narration === 'voice') void speak(text);
  }, [heard, narration]);

  return (
    <>
      <p aria-live="polite">
        {micOn ? `Clicks heard: ${heard} of ${ONBOARDING.micTestClicks}.` : 'Microphone is off.'}
      </p>
      <button type="button" onClick={onDone} autoFocus>
        Done (Enter)
      </button>
    </>
  );
}

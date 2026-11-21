// First-run setup (§9.5): Start → screen-reader question → headphone check → optional mic → level list.
// The screen-reader question comes before the headphone check so speech never talks over a screen reader
// (see the CLAUDE.md Decisions log).
import { useEffect, useState, type KeyboardEvent } from 'react';
import { unlockAudio } from '../audio/context';
import { lrTest } from '../audio/sfx';
import { spokenNumber } from '../levels/feedback';
import { initNarrator, speak } from '../speech/narrator';
import { setOnboarded } from '../state/progress';
import { goToLevelSelect, say, setClickSource } from '../state/runner';
import { useEcho } from '../state/store';

type Step = 'start' | 'narration' | 'headphones' | 'mic' | 'micTest';
type Side = 'left' | 'right';

const MIC_TEST_CLICKS = 3;

export function Onboarding() {
  const [step, setStep] = useState<Step>('start');
  const [side, setSide] = useState<Side>('left');
  const [misses, setMisses] = useState(0);
  const [micBaseline, setMicBaseline] = useState(0);
  const setSettings = useEcho((s) => s.setSettings);

  const playSide = async (s: Side) => {
    setSide(s);
    await say(`Press ${s} arrow when you hear the tone.`);
    await lrTest(s);
  };

  const start = async () => {
    await unlockAudio();
    initNarrator();
    setStep('narration');
    await say('Welcome to Echo. Do you use a screen reader? Choose yes or no.');
  };

  const chooseNarration = async (screenReader: boolean) => {
    setSettings({ narration: screenReader ? 'screenreader' : 'voice' });
    setStep('headphones');
    await say('Headphone check. Put on your headphones.');
    await playSide('left');
  };

  const answerSide = async (heard: Side) => {
    if (heard !== side) {
      const n = misses + 1;
      setMisses(n);
      if (n >= 2) {
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

  const goToMic = async () => {
    setStep('mic');
    await say('Use your own tongue click? You can turn this on later in Settings.');
  };

  const enableMic = async () => {
    // The detector reports each click here instead of to the runner while we test it.
    const source = await setClickSource('mic');
    if (source !== 'mic') return finish();
    setMicBaseline(useEcho.getState().micClicks);
    setStep('micTest');
    await say(`Click your tongue ${MIC_TEST_CLICKS} times.`);
  };

  const finish = async () => {
    setOnboarded(true);
    await goToLevelSelect();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (step !== 'headphones' || e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      void answerSide(e.key === 'ArrowLeft' ? 'left' : 'right');
    }
  };

  return (
    <div className="onboarding" onKeyDown={onKeyDown}>
      {step === 'start' && (
        <button type="button" onClick={() => void start()} autoFocus>
          Start
        </button>
      )}
      {step === 'narration' && (
        <>
          <p>Do you use a screen reader?</p>
          <button type="button" onClick={() => void chooseNarration(true)} autoFocus>
            Yes, I use a screen reader
          </button>
          <button type="button" onClick={() => void chooseNarration(false)}>
            No, speak to me
          </button>
        </>
      )}
      {step === 'headphones' && (
        <>
          <p>Press the arrow for the side where you hear the tone.</p>
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
            Skip, use the Space key
          </button>
          <button type="button" onClick={() => void enableMic()}>
            Yes, use my microphone
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
    const text = heard >= MIC_TEST_CLICKS
      ? `${spokenNumber(heard)} clicks heard. The microphone works.`
      : `${spokenNumber(heard)} clicks heard so far.`;
    if (narration === 'voice') void speak(text);
  }, [heard, narration]);

  return (
    <>
      <p aria-live="polite">
        {micOn ? `Clicks heard: ${heard} of ${MIC_TEST_CLICKS}.` : 'Microphone is off.'}
      </p>
      <button type="button" onClick={onDone} autoFocus>
        Done
      </button>
    </>
  );
}

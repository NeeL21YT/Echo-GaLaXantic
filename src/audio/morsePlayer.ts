// Plays Morse feedback by vibration or by a tone (§13.4). Always waits for speech and stimuli to finish first,
// so it never lands on top of something the learner needs to hear.
import { MORSE } from '../config';
import { cancelVibration, vibrate } from '../native/echoNative';
import { morseTimings, totalMs } from '../speech/morse';
import { awaitIdle } from '../speech/narrator';
import { getAudioContext } from './context';
import { isPlaying } from './player';

export type MorseMode = 'off' | 'vibration' | 'sound';

let token = 0;
let tone: OscillatorNode | null = null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitForQuiet(): Promise<void> {
  await awaitIdle();
  while (isPlaying()) await sleep(50);
}

/** Cuts off any Morse in progress. */
export function cancelMorse(): void {
  token += 1;
  tone?.stop();
  tone = null;
  void cancelVibration();
}

export async function playMorse(text: string, mode: MorseMode): Promise<void> {
  if (mode === 'off') return;
  const timings = morseTimings(text);
  if (timings.length === 0) return;
  cancelMorse();
  const mine = token;
  await waitForQuiet();
  if (mine !== token) return;

  if (mode === 'vibration') {
    await vibrate(timings);
    await sleep(totalMs(timings));
    return;
  }

  const ctx = getAudioContext();
  const osc = new OscillatorNode(ctx, { type: 'sine', frequency: MORSE.toneHz });
  const gain = new GainNode(ctx, { gain: 0 });
  osc.connect(gain).connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05;
  let at = t0;
  const ramp = 0.005; // short fades so each dot and dash starts and ends without a click
  timings.forEach((ms, i) => {
    const dur = ms / 1000;
    if (i % 2 === 0) {
      gain.gain.setTargetAtTime(MORSE.toneGain, at, ramp);
      gain.gain.setTargetAtTime(0, at + dur, ramp);
    }
    at += dur;
  });
  osc.start(t0);
  osc.stop(at + 0.1);
  tone = osc;
  await sleep(totalMs(timings) + 100);
}

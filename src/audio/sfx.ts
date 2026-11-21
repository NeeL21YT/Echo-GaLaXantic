// Procedural sound effects (§6.5). No audio files, so the app stays small and works offline.
import { SFX } from '../config';
import { getAudioContext } from './context';
import { getMasterBus } from './player';

type ToneSpec = { freqHz: number; startS: number; durS: number; gain: number; decay?: boolean };

/** Schedules tones on the live context; resolves when the last one ends. */
function playTones(tones: ToneSpec[], panValue?: number): Promise<void> {
  const ctx = getAudioContext();
  const t0 = ctx.currentTime;
  let out: AudioNode = getMasterBus();
  if (panValue !== undefined) {
    const panner = new StereoPannerNode(ctx, { pan: panValue });
    panner.connect(out);
    out = panner;
  }
  let lastEnd = t0;
  let lastOsc: OscillatorNode | null = null;
  for (const t of tones) {
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: t.freqHz });
    const g = new GainNode(ctx, { gain: SFX.silenceGain });
    const start = t0 + t.startS;
    const end = start + t.durS;
    g.gain.setValueAtTime(SFX.silenceGain, start);
    g.gain.linearRampToValueAtTime(t.gain, start + SFX.fadeS);
    if (t.decay) {
      g.gain.exponentialRampToValueAtTime(SFX.silenceGain, end);
    } else {
      g.gain.setValueAtTime(t.gain, end - SFX.fadeS);
      g.gain.linearRampToValueAtTime(SFX.silenceGain, end);
    }
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(end);
    if (end >= lastEnd) {
      lastEnd = end;
      lastOsc = osc;
    }
  }
  return new Promise<void>((resolve) => {
    if (!lastOsc) return resolve();
    lastOsc.onended = () => resolve();
  });
}

export const bump = (): Promise<void> =>
  playTones([{ freqHz: SFX.bump.freqHz, startS: 0, durS: SFX.bump.durS, gain: SFX.gain, decay: true }]);

export const correct = (): Promise<void> =>
  playTones(
    SFX.correct.freqsHz.map((f, i) => ({ freqHz: f, startS: i * SFX.correct.noteS, durS: SFX.correct.noteS, gain: SFX.gain })),
  );

export const wrong = (): Promise<void> =>
  playTones([{ freqHz: SFX.wrong.freqHz, startS: 0, durS: SFX.wrong.durS, gain: SFX.wrong.gain }]);

export const levelUp = (): Promise<void> =>
  playTones(
    SFX.levelUp.freqsHz.map((f, i) => ({ freqHz: f, startS: i * SFX.levelUp.noteS, durS: SFX.levelUp.noteS, gain: SFX.gain })),
  );

export const turnTick = (): Promise<void> =>
  playTones([{ freqHz: SFX.turn.freqHz, startS: 0, durS: SFX.turn.durS, gain: SFX.turn.gain }]);

export const lrTest = (side: 'left' | 'right'): Promise<void> =>
  playTones([{ freqHz: SFX.lrTest.freqHz, startS: 0, durS: SFX.lrTest.durS, gain: SFX.gain }], side === 'left' ? -1 : 1);

/** A short band-passed noise burst so each step is audible (Segment 5). */
export function footstep(): Promise<void> {
  const ctx = getAudioContext();
  const frames = Math.ceil(SFX.footstep.durS * ctx.sampleRate);
  const buf = new AudioBuffer({ length: frames, numberOfChannels: 1, sampleRate: ctx.sampleRate });
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Linear fade-out so the burst doesn't end in a click.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = new AudioBufferSourceNode(ctx, { buffer: buf });
  const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: SFX.footstep.bandHz, Q: SFX.footstep.q });
  const g = new GainNode(ctx, { gain: SFX.footstep.gain });
  src.connect(bp).connect(g).connect(getMasterBus());
  return new Promise<void>((resolve) => {
    src.onended = () => resolve();
    src.start();
  });
}

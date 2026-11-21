import { SAMPLE_RATE } from '../config';

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' });
  return ctx;
}

/** Creates/resumes the AudioContext. Must be called from a user gesture (Chrome autoplay policy). */
export async function unlockAudio(): Promise<void> {
  const c = getAudioContext();
  if (c.state !== 'running') await c.resume();
}

export function isAudioUnlocked(): boolean {
  return ctx !== null && ctx.state === 'running';
}

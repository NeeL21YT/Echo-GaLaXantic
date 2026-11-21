import { LIMITER, MASTER_GAIN } from '../config';
import { getAudioContext } from './context';

type Bus = { gain: GainNode; limiter: DynamicsCompressorNode };
type Playing = { src: AudioBufferSourceNode; resolve: () => void };

let bus: Bus | null = null;
let current: Playing | null = null;
let volume = 1;

/** Fixed master gain → limiter → output (§6.4). All app audio, SFX included, goes through this bus. */
export function getMasterBus(): AudioNode {
  if (!bus) {
    const ctx = getAudioContext();
    const gain = new GainNode(ctx, { gain: MASTER_GAIN * volume });
    const limiter = new DynamicsCompressorNode(ctx, {
      threshold: LIMITER.threshold,
      knee: LIMITER.knee,
      ratio: LIMITER.ratio,
      attack: LIMITER.attack,
      release: LIMITER.release,
    });
    gain.connect(limiter).connect(ctx.destination);
    bus = { gain, limiter };
  }
  return bus.gain;
}

/** Volume is a user multiplier (0–1) on the fixed master gain, never a per-scene normalisation. */
export function setVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  if (bus) bus.gain.gain.value = MASTER_GAIN * volume;
}

/** Plays a stimulus, stopping any stimulus already playing. Resolves when it ends or is stopped. */
export function play(buffer: AudioBuffer): Promise<void> {
  stopAll();
  const ctx = getAudioContext();
  const src = new AudioBufferSourceNode(ctx, { buffer });
  src.connect(getMasterBus());
  return new Promise<void>((resolve) => {
    const playing: Playing = { src, resolve };
    src.onended = () => {
      if (current === playing) current = null;
      resolve();
    };
    current = playing;
    src.start();
  });
}

export function stopAll(): void {
  const playing = current;
  if (!playing) return;
  current = null;
  playing.src.onended = null;
  try {
    playing.src.stop();
  } catch {
    // Already stopped: nothing to do.
  }
  playing.resolve();
}

export function isPlaying(): boolean {
  return current !== null;
}

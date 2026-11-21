// Pure ranging DSP (§13.6): a matched filter finds the direct path and the first wall echo in a recording.
// No DOM, no audio. audio/ranger.ts plays the chirp and captures the take.
import { RANGING, SPEED_OF_SOUND } from '../config';

/** Linear sweep with a Hann window, so its correlation sidelobes stay low. */
export function makeChirp(sampleRate: number): Float32Array {
  const n = Math.round(RANGING.chirpDurationS * sampleRate);
  const out = new Float32Array(n);
  const { chirpStartHz: f0, chirpEndHz: f1, chirpDurationS: T, chirpGain } = RANGING;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * (f0 * t + ((f1 - f0) / (2 * T)) * t * t);
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    out[i] = chirpGain * hann * Math.sin(phase);
  }
  return out;
}

/** Cross-correlation of the recording with the chirp; index i is how well the chirp fits starting at sample i. */
export function matchedFilter(recording: Float32Array, chirp: Float32Array): Float32Array {
  const n = Math.max(0, recording.length - chirp.length + 1);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < chirp.length; k++) sum += (recording[i + k] ?? 0) * (chirp[k] ?? 0);
    out[i] = sum;
  }
  return out;
}

/** Rectified, then a sliding max over about one carrier cycle, so each echo is one smooth hump. */
export function envelope(corr: Float32Array, sampleRate: number): Float32Array {
  const w = Math.max(1, Math.round(sampleRate / RANGING.chirpEndHz));
  const out = new Float32Array(corr.length);
  for (let i = 0; i < corr.length; i++) {
    let m = 0;
    const lo = Math.max(0, i - w);
    const hi = Math.min(corr.length - 1, i + w);
    for (let j = lo; j <= hi; j++) m = Math.max(m, Math.abs(corr[j] ?? 0));
    out[i] = m;
  }
  return out;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export type Range = {
  distanceM: number;
  /** Echo peak divided by the direct-path peak; a rough confidence. */
  strength: number;
};

/**
 * Nearest surface from one take. The direct speaker-to-mic path is the strongest peak by far, so it anchors time zero;
 * the first later peak that clears the noise floor and the sidelobe floor is the wall.
 */
export function estimateNearestSurface(recording: Float32Array, chirp: Float32Array, sampleRate: number): Range | null {
  const env = envelope(matchedFilter(recording, chirp), sampleRate);
  if (env.length === 0) return null;

  let directIdx = 0;
  for (let i = 1; i < env.length; i++) if ((env[i] ?? 0) > (env[directIdx] ?? 0)) directIdx = i;
  const direct = env[directIdx] ?? 0;
  if (direct <= 0) return null;

  const toSamples = (m: number) => Math.round(((2 * m) / SPEED_OF_SOUND) * sampleRate);
  const first = directIdx + toSamples(RANGING.minDistanceM);
  const last = Math.min(env.length - 1, directIdx + toSamples(RANGING.maxDistanceM));
  if (first >= last) return null;

  const noise = median(Array.from(env.subarray(first, last + 1)));
  const floor = Math.max(noise * RANGING.peakToNoise, direct * RANGING.minRelativeStrength);
  // A peak must be the maximum within one chirp length each side, so one echo is not counted as several.
  const guard = chirp.length;
  for (let i = first; i <= last; i++) {
    const v = env[i] ?? 0;
    if (v < floor) continue;
    let isPeak = true;
    for (let j = Math.max(0, i - guard); j <= Math.min(env.length - 1, i + guard); j++) {
      if ((env[j] ?? 0) > v) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) {
      return { distanceM: ((i - directIdx) / sampleRate) * (SPEED_OF_SOUND / 2), strength: v / direct };
    }
  }
  return null;
}

/** Median of several pings; null when too few of them found a wall to trust. */
export function combinePings(ranges: readonly (Range | null)[]): Range | null {
  const found = ranges.filter((r): r is Range => r !== null);
  if (found.length * 2 <= ranges.length) return null;
  return {
    distanceM: median(found.map((r) => r.distanceM)),
    strength: median(found.map((r) => r.strength)),
  };
}

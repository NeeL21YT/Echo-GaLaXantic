// Pure click-quality analysis (§13.7): from a short window of mic samples around one tongue click, decide whether it
// is loud enough, sharp enough and bright enough to make a clear echo. No DOM, no audio.
import { CLICK_COACH } from '../config';

export type ClickVerdict = 'good' | 'quiet' | 'loud' | 'long' | 'dull';

export type ClickReport = {
  verdict: ClickVerdict;
  peak: number;
  durationMs: number;
  /** Share of the click's energy above the lowpass frequency, 0 to 1. */
  brightness: number;
};

function smoothedEnvelope(samples: Float32Array, sampleRate: number): Float32Array {
  const w = Math.max(1, Math.round((CLICK_COACH.envelopeSmoothMs / 1000) * sampleRate));
  const out = new Float32Array(samples.length);
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += Math.abs(samples[i] ?? 0);
    if (i >= w) sum -= Math.abs(samples[i - w] ?? 0);
    out[i] = sum / Math.min(i + 1, w);
  }
  return out;
}

export function brightnessOf(samples: Float32Array, sampleRate: number): number {
  const a = Math.exp((-2 * Math.PI * CLICK_COACH.lowpassHz) / sampleRate);
  let low = 0;
  let lowEnergy = 0;
  let totalEnergy = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i] ?? 0;
    low = a * low + (1 - a) * x;
    lowEnergy += low * low;
    totalEnergy += x * x;
  }
  if (totalEnergy === 0) return 0;
  return Math.min(1, Math.max(0, 1 - lowEnergy / totalEnergy));
}

/** Samples should start about preMs before the onset and run for postMs after it. */
export function analyzeClick(samples: Float32Array, sampleRate: number): ClickReport {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i] ?? 0));

  const env = smoothedEnvelope(samples, sampleRate);
  let peakIdx = 0;
  for (let i = 1; i < env.length; i++) if ((env[i] ?? 0) > (env[peakIdx] ?? 0)) peakIdx = i;
  const cutoff = (env[peakIdx] ?? 0) * CLICK_COACH.decayFraction;
  let endIdx = env.length - 1;
  for (let i = peakIdx; i < env.length; i++) {
    if ((env[i] ?? 0) < cutoff) {
      endIdx = i;
      break;
    }
  }
  const onsetIdx = Math.round((CLICK_COACH.preMs / 1000) * sampleRate);
  const durationMs = (Math.max(0, endIdx - onsetIdx) / sampleRate) * 1000;
  const brightness = brightnessOf(samples, sampleRate);

  // Order matters: say the most useful single fix first.
  let verdict: ClickVerdict = 'good';
  if (peak > CLICK_COACH.loudPeak) verdict = 'loud';
  else if (peak < CLICK_COACH.quietPeak) verdict = 'quiet';
  else if (durationMs > CLICK_COACH.maxDurationMs) verdict = 'long';
  else if (brightness < CLICK_COACH.minBrightness) verdict = 'dull';
  return { verdict, peak, durationMs, brightness };
}

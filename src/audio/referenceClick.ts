import { CLICK, SAMPLE_RATE } from '../config';
import { mulberry32 } from '../engine/rng';

let cached: AudioBuffer | null = null;

/** The raw click samples (§6.2): decaying 3.2 kHz sinusoid + white noise, Hann-windowed, peak-normalised. */
export function makeClickSamples(sampleRate: number = SAMPLE_RATE): Float32Array<ArrayBuffer> {
  const n = Math.round(CLICK.durationS * sampleRate);
  const rng = mulberry32(CLICK.noiseSeed);
  const out = new Float32Array(new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT));
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const tone = Math.sin(2 * Math.PI * CLICK.freqHz * t) * Math.exp(-t / CLICK.decayTauS);
    const noise = CLICK.noiseMix * (2 * rng() - 1);
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    const v = (tone + noise) * hann;
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  if (peak > 0) {
    const k = CLICK.peak / peak;
    for (let i = 0; i < n; i++) out[i] = (out[i] ?? 0) * k;
  }
  return out;
}

/** Cached mono AudioBuffer of the reference click; usable in both live and offline contexts. */
export function getReferenceClick(): AudioBuffer {
  if (!cached) {
    const samples = makeClickSamples(SAMPLE_RATE);
    cached = new AudioBuffer({ length: samples.length, numberOfChannels: 1, sampleRate: SAMPLE_RATE });
    cached.copyToChannel(samples, 0);
  }
  return cached;
}

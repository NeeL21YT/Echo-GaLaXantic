import { describe, expect, it } from 'vitest';
import { CLICK_COACH } from '../src/config';
import { analyzeClick, brightnessOf } from '../src/engine/clickQuality';

const SR = 48000;
const LEN = Math.round(((CLICK_COACH.preMs + CLICK_COACH.postMs) / 1000) * SR);
const ONSET = Math.round((CLICK_COACH.preMs / 1000) * SR);

/** A decaying sine burst starting at the onset, with a fixed sprinkle of noise so it is not unrealistically clean. */
function burst(freqHz: number, amp: number, tauMs: number): Float32Array {
  const out = new Float32Array(LEN);
  let s = 12345;
  for (let i = 0; i < LEN; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = 0.002 * (s / 0xffffffff - 0.5);
  }
  for (let i = ONSET; i < LEN; i++) {
    const t = (i - ONSET) / SR;
    out[i] = (out[i] ?? 0) + amp * Math.exp(-t / (tauMs / 1000)) * Math.sin(2 * Math.PI * freqHz * t);
  }
  return out;
}

describe('analyzeClick', () => {
  it('accepts a short, bright, audible click', () => {
    const r = analyzeClick(burst(3200, 0.5, 2), SR);
    expect(r.verdict).toBe('good');
    expect(r.durationMs).toBeLessThan(CLICK_COACH.maxDurationMs);
    expect(r.brightness).toBeGreaterThan(CLICK_COACH.minBrightness);
  });

  it('says quiet for a faint click', () => {
    expect(analyzeClick(burst(3200, 0.02, 2), SR).verdict).toBe('quiet');
  });

  it('says loud when it clips', () => {
    expect(analyzeClick(burst(3200, 1.2, 2), SR).verdict).toBe('loud');
  });

  it('says long for a drawn-out sound', () => {
    expect(analyzeClick(burst(3200, 0.5, 25), SR).verdict).toBe('long');
  });

  it('says dull for a low, soft pop', () => {
    expect(analyzeClick(burst(700, 0.5, 2), SR).verdict).toBe('dull');
  });

  it('reports silence as quiet', () => {
    expect(analyzeClick(new Float32Array(LEN), SR).verdict).toBe('quiet');
  });
});

describe('brightnessOf', () => {
  it('is higher for 3 kHz than for 500 Hz', () => {
    expect(brightnessOf(burst(3000, 0.5, 5), SR)).toBeGreaterThan(brightnessOf(burst(500, 0.5, 5), SR));
  });
  it('is zero for silence', () => {
    expect(brightnessOf(new Float32Array(100), SR)).toBe(0);
  });
});

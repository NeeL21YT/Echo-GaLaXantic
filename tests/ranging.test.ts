import { describe, expect, it } from 'vitest';
import { RANGING, SPEED_OF_SOUND } from '../src/config';
import { combinePings, estimateNearestSurface, makeChirp, pingsDisagree, pingSpreadM } from '../src/engine/ranging';

const SR = 48000;
const chirp = makeChirp(SR);

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff - 0.5;
  };
}

/** A take with the direct chirp at sample 3000 plus one echo per (distance, gain) pair and a little noise. */
function take(echoes: readonly [number, number][], noise = 0.002): Float32Array {
  const rec = new Float32Array(Math.round(RANGING.recordS * SR));
  const rand = lcg(7);
  for (let i = 0; i < rec.length; i++) rec[i] = noise * rand();
  const add = (at: number, gain: number) => {
    for (let k = 0; k < chirp.length; k++) rec[at + k] = (rec[at + k] ?? 0) + gain * (chirp[k] ?? 0);
  };
  add(3000, 1);
  for (const [d, gain] of echoes) add(3000 + Math.round(((2 * d) / SPEED_OF_SOUND) * SR), gain);
  return rec;
}

describe('estimateNearestSurface', () => {
  it('finds a wall 1.5 m away within 5 cm', () => {
    const r = estimateNearestSurface(take([[1.5, 0.2]]), chirp, SR);
    expect(r).not.toBeNull();
    expect(Math.abs((r?.distanceM ?? 0) - 1.5)).toBeLessThan(0.05);
  });

  it('returns the nearest of two walls', () => {
    const r = estimateNearestSurface(take([[2.5, 0.3], [1.2, 0.15]]), chirp, SR);
    expect(Math.abs((r?.distanceM ?? 0) - 1.2)).toBeLessThan(0.05);
  });

  it('reports nothing in an empty take', () => {
    expect(estimateNearestSurface(take([]), chirp, SR)).toBeNull();
  });

  it('ignores an echo closer than the minimum distance (speaker ringing)', () => {
    expect(estimateNearestSurface(take([[0.1, 0.4]]), chirp, SR)).toBeNull();
  });

  it('ignores an echo beyond the maximum range', () => {
    expect(estimateNearestSurface(take([[RANGING.maxDistanceM + 1.5, 0.4]]), chirp, SR)).toBeNull();
  });

  it('is not fooled by the direct path arriving late (output latency)', () => {
    const rec = new Float32Array(Math.round(RANGING.recordS * SR));
    const at = 9000;
    for (let k = 0; k < chirp.length; k++) rec[at + k] = chirp[k] ?? 0;
    const echoAt = at + Math.round(((2 * 2) / SPEED_OF_SOUND) * SR);
    for (let k = 0; k < chirp.length; k++) rec[echoAt + k] = 0.2 * (chirp[k] ?? 0);
    const r = estimateNearestSurface(rec, chirp, SR);
    expect(Math.abs((r?.distanceM ?? 0) - 2)).toBeLessThan(0.05);
  });
});

describe('combinePings', () => {
  it('takes the median distance', () => {
    const r = combinePings([
      { distanceM: 1.4, strength: 0.2 },
      { distanceM: 1.5, strength: 0.2 },
      { distanceM: 3.0, strength: 0.1 },
      null,
      { distanceM: 1.5, strength: 0.2 },
    ]);
    expect(r?.distanceM).toBeCloseTo(1.5, 5);
  });

  it('gives up when most pings found nothing', () => {
    expect(combinePings([{ distanceM: 1, strength: 0.2 }, null, null, null, null])).toBeNull();
  });
});

describe('disagreement', () => {
  const at = (distanceM: number) => ({ distanceM, strength: 0.2 });

  it('measures the spread of the distances that found a wall', () => {
    expect(pingSpreadM([at(1.5), null, at(1.6), at(2.1)])).toBeCloseTo(0.6, 5);
    expect(pingSpreadM([null, at(1.5), null])).toBeNull();
    expect(pingSpreadM([])).toBeNull();
  });

  it('calls close pings in agreement and far-apart pings a disagreement', () => {
    expect(pingsDisagree([at(1.5), at(1.6), at(1.7), at(1.55), null])).toBe(false);
    expect(pingsDisagree([at(1.2), at(2.4), at(1.5)])).toBe(true);
  });

  it('does not call a single ping a disagreement', () => {
    expect(pingsDisagree([at(1.5), null, null])).toBe(false);
  });
});

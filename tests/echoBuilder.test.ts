import { describe, expect, it } from 'vitest';
import {
  ECHO_GAIN_SCALE, LOWPASS_NUMERATOR_HZ, MAX_VOICES, MIN_DIST_M,
  POLE_RADIUS_M, REFLECTANCE, SPEED_OF_SOUND,
} from '../src/config';
import { buildEchoes, makeVoice } from '../src/engine/echoBuilder';
import { castRays } from '../src/engine/raycaster';
import { corridor, room } from '../src/engine/worlds';
import type { Hit } from '../src/types';

const hit = (d: number, az: number, reflectance: number = REFLECTANCE.wall, cosTheta = 1): Hit => ({
  rayIndex: 0, rayAngleDeg: az, relAzDeg: az, d, point: { x: 0, y: d }, cosTheta, reflectance,
  kind: reflectance === REFLECTANCE.pole ? 'pole' : 'wall',
});

describe('makeVoice', () => {
  it('delays a 1 m echo by 5.831 ms within 0.01 ms', () => {
    expect(Math.abs(makeVoice(1, 0, REFLECTANCE.wall, 1, 1).delayS * 1000 - 5.831)).toBeLessThanOrEqual(0.01);
  });
  it('multiplies delay by stretch without changing the other cues', () => {
    const natural = makeVoice(1, -30, REFLECTANCE.wall, 1, 1);
    expect(makeVoice(1, -30, REFLECTANCE.wall, 1, 4)).toEqual({ ...natural, delayS: natural.delayS * 4 });
  });
  it('uses the specified gain at 0.5 m', () => {
    expect(makeVoice(0.5, 0, 0.9, 1, 1).gain).toBeCloseTo(0.45 * ECHO_GAIN_SCALE, 12);
  });
  it('uses a 4500 Hz cutoff at 1 m and preserves azimuth', () => {
    const voice = makeVoice(1, -90, REFLECTANCE.wall, 1, 1);
    expect(voice.cutoffHz).toBe(4500);
    expect(voice.azDeg).toBe(-90);
  });
  it('clamps distance consistently for all formulas', () => {
    expect(makeVoice(0, 0, REFLECTANCE.wall, 1, 1)).toEqual(makeVoice(MIN_DIST_M, 0, REFLECTANCE.wall, 1, 1));
    expect(makeVoice(0, 0, REFLECTANCE.wall, 1, 1).d).toBe(MIN_DIST_M);
  });
  it('scales gain with reflectance and incidence', () => {
    const base = makeVoice(1, 0, 1, 1, 1).gain;
    expect(makeVoice(1, 0, 0.7, 0.5, 1).gain).toBeCloseTo(base * 0.7 * 0.5);
  });
});

describe('buildEchoes', () => {
  it('returns no voices for empty or zero-gain hits', () => {
    expect(buildEchoes([], 1)).toEqual([]);
    expect(buildEchoes([hit(1, 0, 0), hit(1, 0, REFLECTANCE.wall, 0)], 1)).toEqual([]);
  });
  it('merges gains as energy and uses original gain weights for distance and azimuth', () => {
    const hits = [hit(1, 0, 0.9), hit(1.1, 5, 0.3)];
    const first = makeVoice(1, 0, 0.9, 1, 1);
    const second = makeVoice(1.1, 5, 0.3, 1, 1);
    const expectedDistance = (first.gain + second.gain * 1.1) / (first.gain + second.gain);
    const expectedAz = Math.atan2(second.gain * Math.sin(5 * Math.PI / 180),
      first.gain + second.gain * Math.cos(5 * Math.PI / 180)) * 180 / Math.PI;
    const voices = buildEchoes(hits, 4);
    expect(voices).toHaveLength(1);
    const voice = voices[0]!;
    expect(voice.gain).toBeCloseTo(Math.hypot(first.gain, second.gain), 12);
    expect(voice.d).toBeCloseTo(expectedDistance, 12);
    expect(voice.azDeg).toBeCloseTo(expectedAz, 12);
    expect(voice.delayS).toBeCloseTo(2 * expectedDistance / SPEED_OF_SOUND * 4, 12);
    expect(voice.cutoffHz).toBeCloseTo(LOWPASS_NUMERATOR_HZ / (1 + expectedDistance), 12);
  });
  it('merges +179 and -179 into one rear bin with a circular mean', () => {
    const voices = buildEchoes([hit(1, 179), hit(1, -179)], 1);
    expect(voices).toHaveLength(1);
    expect(voices[0]!.azDeg).toBe(180);
    expect(voices[0]!.gain).toBeCloseTo(Math.SQRT2 * makeVoice(1, 179, REFLECTANCE.wall, 1, 1).gain);
  });
  it('uses a circular gain-weighted mean across the rear seam', () => {
    const voice = buildEchoes([hit(1, 179, 0.9), hit(1, -179, 0.3)], 1)[0]!;
    const radians = 179 * Math.PI / 180;
    const expected = Math.atan2((0.9 - 0.3) * Math.sin(radians), (0.9 + 0.3) * Math.cos(radians)) * 180 / Math.PI;
    expect(voice.azDeg).toBeCloseTo(expected, 10);
    expect(voice.azDeg).toBeGreaterThan(179);
  });
  it('keeps separate azimuth and distance bins separate', () => {
    expect(buildEchoes([hit(1, 0), hit(1, 15), hit(1.25, 0)], 1)).toHaveLength(3);
  });
  it('sorts descending by gain and breaks ties by nearer distance', () => {
    const voices = buildEchoes([hit(2, 0, 1), hit(1, 30, 0.5), hit(1, 60, 1)], 1);
    expect(voices.map(voice => [voice.azDeg, voice.d])).toEqual([[60, 1], [30, 1], [0, 2]]);
  });
  it('keeps the strongest 24 bins', () => {
    const hits = Array.from({ length: 40 }, (_, i) => hit(0.5 + i * 0.25, 0));
    const voices = buildEchoes(hits, 1);
    expect(voices).toHaveLength(MAX_VOICES);
    expect(voices.map(voice => voice.d)).toEqual(hits.slice(0, MAX_VOICES).map(entry => entry.d));
  });
  it('limits a cluttered room with ten poles to 24 voices', () => {
    const world = room(6, 6);
    world.poles = Array.from({ length: 10 }, (_, i) => ({
      c: { x: 2 * Math.sin(i * Math.PI / 5), y: 2 * Math.cos(i * Math.PI / 5) },
      r: POLE_RADIUS_M, kind: 'pole',
    }));
    const voices = buildEchoes(castRays(world, { p: { x: 0, y: 0 }, headingDeg: 0 }), 1);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices.length).toBeLessThanOrEqual(MAX_VOICES);
    expect(voices.every((voice, i) => i === 0 || voices[i - 1]!.gain >= voice.gain)).toBe(true);
  });
  it('retains the pole echo among the strongest corridor voices', () => {
    const world = corridor(2, 10, [{ x: 0, y: 2 }]);
    const hits = castRays(world, { p: { x: 0, y: 0.5 }, headingDeg: 0 });
    expect(hits.some(entry => entry.kind === 'pole')).toBe(true);
    const voices = buildEchoes(hits, 1);
    expect(voices.length).toBeLessThanOrEqual(MAX_VOICES);
    const poleVoices = buildEchoes(hits.filter(entry => entry.kind === 'pole'), 1);
    expect(poleVoices.some(voice => Math.abs(voice.d - (1.5 - POLE_RADIUS_M)) < 0.05)).toBe(true);
    expect(voices.some(voice => Math.abs(voice.azDeg) < 5 && Math.abs(voice.d - (1.5 - POLE_RADIUS_M)) < 0.05)).toBe(true);
  });
  it('does not mutate the input hits and is deterministic', () => {
    const hits = [hit(1, 179), hit(1.1, -179)];
    const before = JSON.stringify(hits);
    expect(buildEchoes(hits, 4)).toEqual(buildEchoes(hits, 4));
    expect(JSON.stringify(hits)).toBe(before);
  });

  it('reserves a slot for a pole echo weaker than 24 wall echoes', () => {
    const walls = Array.from({ length: 30 }, (_, i) => hit(0.5 + i * 0.25, (i * 37) % 360 - 180));
    const weakPole = hit(6, 0, REFLECTANCE.pole, 0.2);
    const voices = buildEchoes([...walls, weakPole], 1);
    expect(voices).toHaveLength(MAX_VOICES);
    expect(voices.some(v => Math.abs(v.d - 6) < 1e-9 && Math.abs(v.azDeg) < 1e-9)).toBe(true);
  });
});

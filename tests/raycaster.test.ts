import { describe, expect, it } from 'vitest';
import { HIT_EPSILON_M, MAX_RANGE_M, POLE_RADIUS_M, RAY_COUNT, RAY_STEP_DEG, REFLECTANCE } from '../src/config';
import { dirFromHeading, wrapDeg } from '../src/engine/geometry';
import { castRays } from '../src/engine/raycaster';
import { corridor, frontWall, room, singleWall } from '../src/engine/worlds';
import type { Pose, World } from '../src/types';

const pose: Pose = { p: { x: 0, y: 0 }, headingDeg: 0 };

describe('castRays', () => {
  it('returns 72 nearest hits from a centred 6 m room', () => {
    const hits = castRays(room(6, 6), pose);
    expect(hits).toHaveLength(RAY_COUNT);
    for (const hit of hits) {
      const dir = dirFromHeading(hit.rayIndex * RAY_STEP_DEG);
      expect(hit.d).toBeCloseTo(3 / Math.max(Math.abs(dir.x), Math.abs(dir.y)));
      expect(hit.point.x).toBeCloseTo(dir.x * hit.d);
      expect(hit.point.y).toBeCloseTo(dir.y * hit.d);
      expect(hit.cosTheta).toBeCloseTo(Math.max(Math.abs(dir.x), Math.abs(dir.y)));
      expect(hit.reflectance).toBe(REFLECTANCE.wall);
    }
  });
  it('removes exactly the rays through a 1 m north gap 3 m ahead', () => {
    const hits = castRays(room(6, 6, [{ wall: 'N', center: 0, width: 1 }]), pose);
    const missing: number[] = [];
    const expected: number[] = [];
    for (let i = 0; i < RAY_COUNT; i++) {
      if (!hits.some(hit => hit.rayIndex === i)) missing.push(i);
      const dir = dirFromHeading(i * RAY_STEP_DEG);
      if (dir.y > 0 && Math.abs(3 * dir.x / dir.y) < 0.5) expected.push(i);
    }
    expect(hits.some(hit => hit.rayIndex === 0)).toBe(false);
    expect(missing).toEqual(expected);
    expect(missing).toEqual([0, 1, 71]);
  });
  it.each([9, MAX_RANGE_M])('does not hit a front wall at %s m', distance => {
    expect(castRays(frontWall(distance), pose)).toEqual([]);
  });
  it('accepts a wall just inside range and rejects epsilon', () => {
    expect(castRays(frontWall(MAX_RANGE_M - HIT_EPSILON_M), pose).find(hit => hit.rayIndex === 0)?.d)
      .toBeCloseTo(MAX_RANGE_M - HIT_EPSILON_M);
    expect(castRays(frontWall(HIT_EPSILON_M), pose).some(hit => hit.rayIndex === 0)).toBe(false);
  });
  it('only returns negative relative azimuths for a left wall', () => {
    const hits = castRays(singleWall('left', 1.5), pose);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(hit => hit.relAzDeg < 0)).toBe(true);
    expect(hits.find(hit => hit.relAzDeg === -90)?.d).toBeCloseTo(1.5);
  });
  it('rotates world angles but keeps relative azimuths', () => {
    const hits = castRays(room(6, 6), { ...pose, headingDeg: 90 });
    expect(hits[0]!.rayAngleDeg).toBe(90);
    expect(hits[0]!.point.x).toBeCloseTo(3);
    for (const hit of hits) {
      expect(hit.rayAngleDeg).toBe(90 + hit.rayIndex * RAY_STEP_DEG);
      expect(hit.relAzDeg).toBe(wrapDeg(hit.rayIndex * RAY_STEP_DEG));
    }
    expect(hits.find(hit => hit.rayIndex === RAY_COUNT / 2)?.relAzDeg).toBe(180);
  });
  it('selects the nearest wall regardless of segment order', () => {
    const world = room(6, 6);
    world.segments.push(...frontWall(1).segments);
    expect(castRays(world, pose).find(hit => hit.rayIndex === 0)?.d).toBe(1);
    expect(castRays({ ...world, segments: [...world.segments].reverse() }, pose)).toEqual(castRays(world, pose));
  });
  it('selects a pole before a wall and uses its surface normal', () => {
    const world = room(6, 6);
    world.poles.push({ c: { x: 0, y: 2 }, r: POLE_RADIUS_M, kind: 'pole' });
    const hit = castRays(world, pose).find(hit => hit.rayIndex === 0);
    expect(hit?.d).toBeCloseTo(2 - POLE_RADIUS_M);
    expect(hit?.cosTheta).toBeCloseTo(1);
    expect(hit?.reflectance).toBe(REFLECTANCE.pole);
    const pole = world.poles[0]!;
    const oblique = castRays(world, { p: { x: 0.1, y: 0 }, headingDeg: 0 })[0]!;
    const normal = { x: (oblique.point.x - pole.c.x) / pole.r, y: (oblique.point.y - pole.c.y) / pole.r };
    expect(oblique.cosTheta).toBeCloseTo(Math.abs(normal.y));
  });
  it('does not select a pole occluded by a nearer wall', () => {
    const world = frontWall(1);
    world.poles.push({ c: { x: 0, y: 2 }, r: POLE_RADIUS_M, kind: 'pole' });
    expect(castRays(world, pose).find(hit => hit.rayIndex === 0)?.reflectance).toBe(REFLECTANCE.wall);
  });
  it('leaves the corridor exit silent even within range', () => {
    expect(castRays(corridor(2, 4), { p: { x: 0, y: 0.5 }, headingDeg: 0 }).some(hit => hit.rayIndex === 0)).toBe(false);
  });
  it('returns no hits in an empty world and does not mutate inputs', () => {
    const world: World = { segments: [], poles: [], bounds: { w: 16, h: 16 } };
    const before = JSON.stringify({ world, pose });
    expect(castRays(world, pose)).toEqual([]);
    expect(JSON.stringify({ world, pose })).toBe(before);
  });
  it('casts all rays against a 50-segment enclosure', () => {
    const world: World = { segments: [], poles: [], bounds: { w: 6, h: 6 } };
    for (let i = 0; i < 50; i++) {
      const a = i * 2 * Math.PI / 50;
      const b = (i + 1) * 2 * Math.PI / 50;
      world.segments.push({
        a: { x: 3 * Math.sin(a), y: 3 * Math.cos(a) },
        b: { x: 3 * Math.sin(b), y: 3 * Math.cos(b) }, kind: 'wall',
      });
    }
    const hits = castRays(world, pose);
    expect(hits).toHaveLength(RAY_COUNT);
    expect(hits.every(hit => hit.d >= 3 * Math.cos(Math.PI / 50) - HIT_EPSILON_M && hit.d <= 3 + HIT_EPSILON_M)).toBe(true);
  });
});

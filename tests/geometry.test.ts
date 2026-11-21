import { describe, expect, it } from 'vitest';
import { HIT_EPSILON_M } from '../src/config';
import {
  add, bearingDeg, degToRad, dirFromHeading, distPointToSegment, distSegmentToSegment,
  dot, length, normalize, rayCircle, raySegment, scale, segmentNormal, sub, vec, wrapDeg,
} from '../src/engine/geometry';
import type { Segment } from '../src/types';

describe('vectors and angles', () => {
  it('implements vector arithmetic without changing inputs', () => {
    const a = Object.freeze(vec(3, 4));
    const b = Object.freeze(vec(-1, 2));
    expect(add(a, b)).toEqual({ x: 2, y: 6 });
    expect(sub(a, b)).toEqual({ x: 4, y: 2 });
    expect(scale(a, 2)).toEqual({ x: 6, y: 8 });
    expect(dot(a, b)).toBe(5);
    expect(length(a)).toBe(5);
    expect(normalize(a).x).toBeCloseTo(0.6);
    expect(normalize(a).y).toBeCloseTo(0.8);
    expect(normalize(vec(0, 0))).toEqual(vec(0, 0));
  });
  it.each([[180, 180], [-180, 180], [540, 180], [-540, 180], [360, 0], [-360, 0], [270, -90], [-450, -90]])(
    'wraps %s to %s', (input, expected) => expect(wrapDeg(input)).toBe(expected),
  );
  it.each([[0, 0, 1], [90, 1, 0], [180, 0, -1], [-90, -1, 0]])(
    'uses clockwise heading %s from +y', (angle, x, y) => {
      const direction = dirFromHeading(angle);
      expect(direction.x).toBeCloseTo(x);
      expect(direction.y).toBeCloseTo(y);
      expect(length(direction)).toBeCloseTo(1);
    },
  );
  it('converts degrees to radians', () => expect(degToRad(180)).toBe(Math.PI));
  it.each([[1, 0, 90], [0, -1, 180], [-1, 0, -90], [0, 1, 0]])(
    'finds the bearing to (%s,%s)', (x, y, expected) => {
      expect(bearingDeg(vec(0, 0), vec(x, y))).toBe(expected);
      expect(bearingDeg(vec(2, 3), vec(x + 2, y + 3))).toBe(expected);
    },
  );
});

describe('raySegment', () => {
  const segment: Segment = { a: vec(-1, 3), b: vec(1, 3), kind: 'wall' };
  it('hits the segment and its endpoints', () => {
    expect(raySegment(vec(0, 0), vec(0, 1), segment)).toBe(3);
    expect(raySegment(vec(1, 0), vec(0, 1), segment)).toBe(3);
    expect(raySegment(vec(0, 0), vec(0, 1), { ...segment, a: segment.b, b: segment.a })).toBe(3);
  });
  it('misses beyond the segment', () => expect(raySegment(vec(2, 0), vec(0, 1), segment)).toBeNull());
  it('misses behind the ray', () => expect(raySegment(vec(0, 4), vec(0, 1), segment)).toBeNull());
  it('treats parallel and collinear rays as misses', () => {
    expect(raySegment(vec(0, 0), vec(1, 0), segment)).toBeNull();
    expect(raySegment(vec(-2, 3), vec(1, 0), segment)).toBeNull();
  });
  it('rejects intersections on the origin or at epsilon', () => {
    expect(raySegment(vec(0, 3), vec(0, 1), segment)).toBeNull();
    expect(raySegment(vec(0, 0), vec(0, 1), {
      a: vec(-1, HIT_EPSILON_M), b: vec(1, HIT_EPSILON_M), kind: 'wall',
    })).toBeNull();
  });
  it('rejects a degenerate segment', () => {
    expect(raySegment(vec(0, 0), vec(0, 1), { a: vec(0, 3), b: vec(0, 3), kind: 'wall' })).toBeNull();
  });
});

describe('rayCircle', () => {
  it('takes the nearest positive crossing', () => expect(rayCircle(vec(0, 0), vec(0, 1), vec(0, 3), 1)).toBe(2));
  it('misses a circle outside the ray', () => expect(rayCircle(vec(0, 0), vec(0, 1), vec(2, 3), 1)).toBeNull());
  it('hits a tangent', () => expect(rayCircle(vec(0, 0), vec(0, 1), vec(1, 3), 1)).toBe(3));
  it('rejects a circle behind the ray', () => expect(rayCircle(vec(0, 0), vec(0, 1), vec(0, -3), 1)).toBeNull());
  it('uses the far crossing when inside', () => expect(rayCircle(vec(0, 3), vec(0, 1), vec(0, 3), 1)).toBe(1));
  it('skips a crossing at the origin', () => {
    expect(rayCircle(vec(0, 2), vec(0, 1), vec(0, 3), 1)).toBe(2);
    expect(rayCircle(vec(0, 4), vec(0, 1), vec(0, 3), 1)).toBeNull();
  });
  it('rejects a crossing at epsilon', () => {
    expect(rayCircle(vec(0, 0), vec(0, 1), vec(0, HIT_EPSILON_M / 2), HIT_EPSILON_M / 2)).toBeNull();
  });
});

describe('surface distances', () => {
  it('returns a perpendicular unit normal', () => {
    const segment: Segment = { a: vec(1, 2), b: vec(4, 6), kind: 'wall' };
    const normal = segmentNormal(segment);
    expect(length(normal)).toBeCloseTo(1);
    expect(dot(normal, sub(segment.b, segment.a))).toBeCloseTo(0);
    expect(segmentNormal({ ...segment, b: segment.a })).toEqual(vec(0, 0));
  });
  it('projects onto the interior and clamps to both endpoints', () => {
    expect(distPointToSegment(vec(1, 2), vec(0, 0), vec(2, 0))).toBe(2);
    expect(distPointToSegment(vec(-3, 4), vec(0, 0), vec(2, 0))).toBe(5);
    expect(distPointToSegment(vec(5, 4), vec(0, 0), vec(2, 0))).toBe(5);
    expect(distPointToSegment(vec(3, 4), vec(0, 0), vec(0, 0))).toBe(5);
  });
  it('finds crossings, collinear overlap and separated segment distances', () => {
    expect(distSegmentToSegment(vec(-1, 0), vec(1, 0), vec(0, -1), vec(0, 1))).toBe(0);
    expect(distSegmentToSegment(vec(0, 0), vec(2, 0), vec(1, 0), vec(3, 0))).toBe(0);
    expect(distSegmentToSegment(vec(0, 0), vec(1, 0), vec(0, 2), vec(1, 2))).toBe(2);
    expect(distSegmentToSegment(vec(0, 0), vec(0, 0), vec(3, 0), vec(3, 4))).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { POLE_RADIUS_M } from '../src/config';
import { corridor, frontWall, lCorridor, room, singleWall } from '../src/engine/worlds';
import type { WallSide } from '../src/engine/worlds';

describe('room', () => {
  it('centres all four walls on the origin', () => {
    const world = room(6, 4);
    expect(world.bounds).toEqual({ w: 6, h: 4 });
    expect(world.poles).toEqual([]);
    expect(world.segments).toEqual([
      { a: { x: -3, y: 2 }, b: { x: 3, y: 2 }, kind: 'wall' },
      { a: { x: 3, y: -2 }, b: { x: 3, y: 2 }, kind: 'wall' },
      { a: { x: -3, y: -2 }, b: { x: 3, y: -2 }, kind: 'wall' },
      { a: { x: -3, y: -2 }, b: { x: -3, y: 2 }, kind: 'wall' },
    ]);
  });
  it.each<WallSide>(['N', 'S', 'E', 'W'])('measures the %s gap from the wall midpoint', side => {
    const world = room(6, 6, [{ wall: side, center: 1, width: 1 }]);
    const horizontal = side === 'N' || side === 'S';
    const fixed = side === 'N' || side === 'E' ? 3 : -3;
    const pieces = world.segments.filter(segment => horizontal
      ? segment.a.y === fixed && segment.b.y === fixed
      : segment.a.x === fixed && segment.b.x === fixed);
    expect(pieces.map(segment => horizontal ? [segment.a.x, segment.b.x] : [segment.a.y, segment.b.y]))
      .toEqual([[-3, 0.5], [1.5, 3]]);
  });
  it('clips a gap overlapping a wall end', () => {
    const pieces = room(6, 6, [{ wall: 'N', center: 3, width: 2 }]).segments.filter(segment => segment.a.y === 3 && segment.b.y === 3);
    expect(pieces).toEqual([{ a: { x: -3, y: 3 }, b: { x: 2, y: 3 }, kind: 'wall' }]);
  });
  it('sorts and unions overlapping gaps', () => {
    const pieces = room(6, 6, [
      { wall: 'N', center: 0.5, width: 2 }, { wall: 'N', center: -0.5, width: 2 },
    ]).segments.filter(segment => segment.a.y === 3 && segment.b.y === 3);
    expect(pieces.map(segment => [segment.a.x, segment.b.x])).toEqual([[-3, -1.5], [1.5, 3]]);
  });
  it('drops zero-length pieces for touching, duplicate and full-wall gaps', () => {
    const world = room(6, 6, [
      { wall: 'N', center: -1, width: 2 }, { wall: 'N', center: 1, width: 2 },
      { wall: 'N', center: 1, width: 2 }, { wall: 'S', center: 0, width: 20 },
      { wall: 'W', center: 10, width: 1 }, { wall: 'E', center: 0, width: 0 },
      { wall: 'E', center: 0, width: -1 },
    ]);
    expect(world.segments).toHaveLength(4);
    expect(world.segments.every(segment => Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) > 0)).toBe(true);
    expect(world.segments.some(segment => segment.a.y === -3 && segment.b.y === -3)).toBe(false);
    expect(room(0, 0).segments).toEqual([]);
  });
});

describe('isolated walls', () => {
  it.each(['left', 'right'] as const)('builds only the %s wall', side => {
    const world = singleWall(side, 1.5);
    const x = side === 'left' ? -1.5 : 1.5;
    expect(world.segments).toEqual([{ a: { x, y: -2 }, b: { x, y: 2 }, kind: 'wall' }]);
    expect(world.bounds).toEqual({ w: 16, h: 16 });
  });
  it('builds a front wall at positive y', () => {
    const world = frontWall(2);
    expect(world.segments).toEqual([{ a: { x: -2, y: 2 }, b: { x: 2, y: 2 }, kind: 'wall' }]);
    expect(world.bounds).toEqual({ w: 16, h: 16 });
  });
});

describe('corridors', () => {
  it('defaults to two side walls, a back wall and an open far end', () => {
    const world = corridor();
    expect(world.bounds).toEqual({ w: 2, h: 10 });
    expect(world.segments).toHaveLength(3);
    expect(world.exit).toEqual({ a: { x: -1, y: 10 }, b: { x: 1, y: 10 } });
    expect(world.segments.some(segment => segment.a.y === 10 && segment.b.y === 10)).toBe(false);
  });
  it('uses custom dimensions and copies pole centres', () => {
    const poles = [{ x: 0.2, y: 2 }];
    const world = corridor(4, 6, poles);
    expect(world.bounds).toEqual({ w: 4, h: 6 });
    expect(world.exit).toEqual({ a: { x: -2, y: 6 }, b: { x: 2, y: 6 } });
    expect(world.poles).toEqual([{ c: { x: 0.2, y: 2 }, r: POLE_RADIUS_M, kind: 'pole' }]);
    expect(world.poles[0]!.c).not.toBe(poles[0]);
  });
  it('forms the documented L with a closed back and open east exit', () => {
    const world = lCorridor();
    expect(world.segments).toHaveLength(5);
    expect(world.segments).toContainEqual({ a: { x: -1, y: 0 }, b: { x: 1, y: 0 }, kind: 'wall' });
    expect(world.segments).toContainEqual({ a: { x: 1, y: 0 }, b: { x: 1, y: 6 }, kind: 'wall' });
    expect(world.segments).toContainEqual({ a: { x: 1, y: 6 }, b: { x: 7, y: 6 }, kind: 'wall' });
    expect(world.exit).toEqual({ a: { x: 7, y: 6 }, b: { x: 7, y: 8 } });
    expect(world.bounds).toEqual({ w: 8, h: 8 });
    expect(world.segments.every(segment => segment.a.x !== 7 || segment.b.x !== 7)).toBe(true);
  });
});

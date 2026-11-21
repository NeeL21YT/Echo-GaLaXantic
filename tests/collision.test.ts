import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS_M, POLE_RADIUS_M, STEP_M, TURN_DEG } from '../src/config';
import { move, reachedExit, turn } from '../src/engine/collision';
import { corridor, frontWall, lCorridor, room } from '../src/engine/worlds';
import type { Pose, World } from '../src/types';

const start: Pose = { p: { x: 0, y: 0.5 }, headingDeg: 0 };

describe('move', () => {
  it('blocks walking into a wall and returns the original pose', () => {
    const result = move(start, STEP_M, frontWall(1));
    expect(result.collided).toBe(true);
    expect(result.pose).toBe(start);
  });
  it('moves forward or backward along the heading in clear space', () => {
    const world = room(6, 6);
    expect(move(start, STEP_M, world)).toEqual({ pose: { p: { x: 0, y: 1 }, headingDeg: 0 }, collided: false });
    expect(move(start, -STEP_M, world)).toEqual({ pose: { p: { x: 0, y: 0 }, headingDeg: 0 }, collided: false });
    const east = move({ p: { x: 0, y: 0 }, headingDeg: 90 }, STEP_M, world);
    expect(east.pose.p.x).toBeCloseTo(STEP_M);
    expect(east.pose.p.y).toBeCloseTo(0);
    expect(east.collided).toBe(false);
  });
  it('blocks a 0.5 m step across a thin wall despite clear endpoints', () => {
    const pose: Pose = { p: { x: 0, y: 0 }, headingDeg: 0 };
    const result = move(pose, STEP_M, frontWall(STEP_M / 2));
    expect(result.collided).toBe(true);
    expect(result.pose).toBe(pose);
  });
  it('blocks a backward sweep through a wall', () => {
    expect(move(start, -STEP_M, frontWall(0.25)).collided).toBe(true);
  });
  it('blocks pole edges using the combined radii', () => {
    const world = corridor(2, 10, [{ x: 0, y: 1.25 }]);
    expect(move(start, STEP_M, world).collided).toBe(true);
  });
  it('blocks a sweep across a pole with clear endpoints', () => {
    expect(move(start, 3, corridor(2, 10, [{ x: 0, y: 2 }])).collided).toBe(true);
  });
  it('checks wall endpoints along the entire path', () => {
    const world: World = {
      segments: [{ a: { x: 0.2, y: 1 }, b: { x: 1, y: 1 }, kind: 'wall' }],
      poles: [], bounds: { w: 4, h: 4 },
    };
    expect(move(start, 1, world).collided).toBe(true);
  });
  it('allows exact tangency to a wall or pole', () => {
    const world = corridor();
    const tangent: Pose = { p: { x: 1 - PLAYER_RADIUS_M, y: 0.5 }, headingDeg: 0 };
    expect(move(tangent, STEP_M, world).collided).toBe(false);
    const poleWorld = corridor(4, 10, [{ x: PLAYER_RADIUS_M + POLE_RADIUS_M, y: 1 }]);
    expect(move(start, 1, poleWorld).collided).toBe(false);
  });
  it('allows passage through a sufficiently wide doorway', () => {
    const world = room(6, 6, [{ wall: 'N', center: 0, width: 1 }]);
    expect(move({ p: { x: 0, y: 2.5 }, headingDeg: 0 }, 1, world).collided).toBe(false);
  });
  it('allows both legs of the L but blocks cutting through its inside corner', () => {
    const world = lCorridor();
    const north = move(start, 6.5, world);
    expect(north.collided).toBe(false);
    const east = move(turn(north.pose, 90), 7, world);
    expect(east.collided).toBe(false);
    expect(reachedExit(east.pose, world)).toBe(true);
    expect(move({ p: { x: 0, y: 5 }, headingDeg: 90 }, 2, world).collided).toBe(true);
  });
  it('does not mutate pose or world', () => {
    const world = room(6, 6);
    const before = JSON.stringify({ start, world });
    move(start, STEP_M, world);
    expect(JSON.stringify({ start, world })).toBe(before);
  });
});

describe('turn', () => {
  it.each([TURN_DEG, -TURN_DEG, 180, -180, 540])('turns %s degrees without moving or colliding', angle => {
    const result = turn(start, angle);
    expect(result.p).toBe(start.p);
    expect(result.headingDeg).toBeGreaterThan(-180);
    expect(result.headingDeg).toBeLessThanOrEqual(180);
    expect(start.headingDeg).toBe(0);
    expect(turn(result, -angle)).toEqual(start);
  });
  it('wraps across both limits', () => {
    expect(turn({ ...start, headingDeg: 175 }, TURN_DEG).headingDeg).toBe(-170);
    expect(turn({ ...start, headingDeg: -175 }, -TURN_DEG).headingDeg).toBe(170);
  });
});

describe('reachedExit', () => {
  it('is true near the corridor exit and false at the start', () => {
    const world = corridor();
    expect(reachedExit(start, world)).toBe(false);
    expect(reachedExit({ p: { x: 0, y: 10 - PLAYER_RADIUS_M }, headingDeg: 0 }, world)).toBe(true);
    expect(reachedExit({ p: { x: 0, y: 10.1 }, headingDeg: 180 }, world)).toBe(true);
    expect(reachedExit({ p: { x: 0, y: 9.5 }, headingDeg: 0 }, world)).toBe(false);
  });
  it('measures distance to endpoints rather than the infinite exit line', () => {
    const world = corridor();
    expect(reachedExit({ p: { x: 1.5, y: 10 }, headingDeg: 0 }, world)).toBe(false);
    expect(reachedExit({ p: { x: 1 + PLAYER_RADIUS_M, y: 10 }, headingDeg: 0 }, world)).toBe(true);
  });
  it('is false when the world has no exit', () => expect(reachedExit(start, room(6, 6))).toBe(false));
});

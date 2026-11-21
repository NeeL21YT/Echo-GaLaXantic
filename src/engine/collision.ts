import { PLAYER_RADIUS_M } from '../config';
import type { Pose, World } from '../types';
import { dirFromHeading, distPointToSegment, distSegmentToSegment, wrapDeg } from './geometry';

export function move(pose: Pose, step: number, world: World): { pose: Pose; collided: boolean } {
  const dir = dirFromHeading(pose.headingDeg);
  const candidate = { x: pose.p.x + step * dir.x, y: pose.p.y + step * dir.y };
  for (const segment of world.segments) {
    if (distSegmentToSegment(pose.p, candidate, segment.a, segment.b) < PLAYER_RADIUS_M) {
      return { pose, collided: true };
    }
  }
  for (const pole of world.poles) {
    if (distPointToSegment(pole.c, pose.p, candidate) < PLAYER_RADIUS_M + pole.r) {
      return { pose, collided: true };
    }
  }
  return { pose: { p: candidate, headingDeg: pose.headingDeg }, collided: false };
}

export function turn(pose: Pose, deltaDeg: number): Pose {
  return { p: pose.p, headingDeg: wrapDeg(pose.headingDeg + deltaDeg) };
}

export function reachedExit(pose: Pose, world: World): boolean {
  return world.exit !== undefined && distPointToSegment(pose.p, world.exit.a, world.exit.b) <= PLAYER_RADIUS_M;
}

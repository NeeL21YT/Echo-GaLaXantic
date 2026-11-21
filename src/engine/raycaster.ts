import { HIT_EPSILON_M, MAX_RANGE_M, RAY_COUNT, RAY_STEP_DEG, REFLECTANCE } from '../config';
import type { Hit, Pose, World } from '../types';
import { dirFromHeading, rayCircle, raySegment, wrapDeg } from './geometry';

/** Casts RAY_COUNT rays from the pose; a ray with no hit inside MAX_RANGE_M yields no Hit (doorway silence). */
export function castRays(world: World, pose: Pose): Hit[] {
  const hits: Hit[] = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    const angle = pose.headingDeg + i * RAY_STEP_DEG;
    const dir = dirFromHeading(angle);
    let nearest = MAX_RANGE_M;
    let cosTheta = 0;
    let reflectance = 0;
    let kind: Hit['kind'] = 'wall';
    let found = false;
    for (const segment of world.segments) {
      const d = raySegment(pose.p, dir, segment);
      if (d === null || d <= HIT_EPSILON_M || d >= nearest) continue;
      const dx = segment.b.x - segment.a.x;
      const dy = segment.b.y - segment.a.y;
      cosTheta = Math.abs((-dir.x * dy + dir.y * dx) / Math.hypot(dx, dy));
      reflectance = REFLECTANCE[segment.kind];
      kind = segment.kind;
      nearest = d;
      found = true;
    }
    for (const pole of world.poles) {
      const d = rayCircle(pose.p, dir, pole.c, pole.r);
      if (d === null || d <= HIT_EPSILON_M || d >= nearest) continue;
      const nx = (pose.p.x + d * dir.x - pole.c.x) / pole.r;
      const ny = (pose.p.y + d * dir.y - pole.c.y) / pole.r;
      cosTheta = Math.abs(dir.x * nx + dir.y * ny);
      reflectance = REFLECTANCE[pole.kind];
      kind = pole.kind;
      nearest = d;
      found = true;
    }
    if (found) hits.push({
      rayIndex: i, rayAngleDeg: angle, relAzDeg: wrapDeg(i * RAY_STEP_DEG),
      d: nearest, point: { x: pose.p.x + nearest * dir.x, y: pose.p.y + nearest * dir.y },
      cosTheta, reflectance, kind,
    });
  }
  return hits;
}

import type { Hit, Pose, World } from '../types';

/** Casts RAY_COUNT rays from the pose; a ray with no hit inside MAX_RANGE_M yields no Hit (doorway silence). */
export function castRays(_world: World, _pose: Pose): Hit[] {
  throw new Error('not implemented: castRays');
}

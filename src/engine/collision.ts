import type { Pose, World } from '../types';

export function move(_pose: Pose, _step: number, _world: World): { pose: Pose; collided: boolean } {
  throw new Error('not implemented: move');
}

export function turn(_pose: Pose, _deltaDeg: number): Pose {
  throw new Error('not implemented: turn');
}

export function reachedExit(_pose: Pose, _world: World): boolean {
  throw new Error('not implemented: reachedExit');
}

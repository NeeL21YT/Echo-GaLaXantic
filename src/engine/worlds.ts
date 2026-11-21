// World builders. Worlds are centred on the origin unless stated otherwise.
import type { World } from '../types';

export type WallSide = 'N' | 'E' | 'S' | 'W';
/** `center` is the gap centre measured along the wall from the wall's midpoint (metres). */
export type Gap = { wall: WallSide; center: number; width: number };

export function room(_w: number, _h: number, _gaps?: Gap[]): World {
  throw new Error('not implemented: room');
}

export function singleWall(_side: 'left' | 'right', _dist: number): World {
  throw new Error('not implemented: singleWall');
}

export function frontWall(_dist: number): World {
  throw new Error('not implemented: frontWall');
}

export function corridor(_width?: number, _length?: number, _poles?: { x: number; y: number }[]): World {
  throw new Error('not implemented: corridor');
}

export function lCorridor(): World {
  throw new Error('not implemented: lCorridor');
}

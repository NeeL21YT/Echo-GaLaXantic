import { POLE_RADIUS_M } from '../config';
import type { Segment, Vec2, World } from '../types';

export type WallSide = 'N' | 'E' | 'S' | 'W';
/** `center` is the gap centre measured along the wall from the wall's midpoint (metres). */
export type Gap = { wall: WallSide; center: number; width: number };

const wall = (a: Vec2, b: Vec2): Segment => ({ a, b, kind: 'wall' });

export function room(w: number, h: number, gaps: Gap[] = []): World {
  const segments: Segment[] = [];
  const sides: WallSide[] = ['N', 'E', 'S', 'W'];
  for (const side of sides) {
    const horizontal = side === 'N' || side === 'S';
    const halfLength = (horizontal ? w : h) / 2;
    const fixed = (side === 'N' || side === 'E' ? 1 : -1) * (horizontal ? h : w) / 2;
    const point = (along: number): Vec2 => horizontal ? { x: along, y: fixed } : { x: fixed, y: along };
    const intervals = gaps.filter(gap => gap.wall === side && gap.width > 0)
      .map(gap => ({
        start: Math.max(-halfLength, gap.center - gap.width / 2),
        end: Math.min(halfLength, gap.center + gap.width / 2),
      }))
      .filter(gap => gap.end > gap.start)
      .sort((a, b) => a.start - b.start);
    // Advancing one cursor unions gaps as it subtracts them, avoiding duplicate wall pieces.
    let cursor = -halfLength;
    for (const gap of intervals) {
      if (gap.start > cursor) segments.push(wall(point(cursor), point(gap.start)));
      cursor = Math.max(cursor, gap.end);
    }
    if (cursor < halfLength) segments.push(wall(point(cursor), point(halfLength)));
  }
  return { segments, poles: [], bounds: { w, h } };
}

export function singleWall(side: 'left' | 'right', dist: number): World {
  const x = side === 'left' ? -dist : dist;
  return {
    segments: [wall({ x, y: -2 }, { x, y: 2 })],
    poles: [], bounds: { w: 16, h: 16 },
  };
}

export function frontWall(dist: number): World {
  return {
    segments: [wall({ x: -2, y: dist }, { x: 2, y: dist })],
    poles: [], bounds: { w: 16, h: 16 },
  };
}

export function corridor(width = 2, length = 10, poles: { x: number; y: number }[] = []): World {
  const halfWidth = width / 2;
  return {
    segments: [
      wall({ x: -halfWidth, y: 0 }, { x: -halfWidth, y: length }),
      wall({ x: halfWidth, y: 0 }, { x: halfWidth, y: length }),
      wall({ x: -halfWidth, y: 0 }, { x: halfWidth, y: 0 }),
    ],
    poles: poles.map(({ x, y }) => ({ c: { x, y }, r: POLE_RADIUS_M, kind: 'pole' })),
    exit: { a: { x: -halfWidth, y: length }, b: { x: halfWidth, y: length } },
    bounds: { w: width, h: length },
  };
}

export function lCorridor(): World {
  // The north leg occupies [-1,1] × [0,8]; the east extension [1,7] × [6,8].
  // Sharing the top 2 m gives a clear turn from (0,0.5), with an open exit at x=7.
  return {
    segments: [
      wall({ x: -1, y: 0 }, { x: 1, y: 0 }),
      wall({ x: -1, y: 0 }, { x: -1, y: 8 }),
      wall({ x: -1, y: 8 }, { x: 7, y: 8 }),
      wall({ x: 1, y: 0 }, { x: 1, y: 6 }),
      wall({ x: 1, y: 6 }, { x: 7, y: 6 }),
    ],
    poles: [],
    exit: { a: { x: 7, y: 6 }, b: { x: 7, y: 8 } },
    bounds: { w: 8, h: 8 },
  };
}

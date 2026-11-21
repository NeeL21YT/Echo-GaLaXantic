// Vector maths and ray intersection. Pure: no DOM, audio or store imports.
// Angle convention: 0° = +y, clockwise positive, so direction = (sin θ, cos θ).
import type { Segment, Vec2 } from '../types';

const ni = (name: string): never => {
  throw new Error(`not implemented: ${name}`);
};

export const vec = (_x: number, _y: number): Vec2 => ni('vec');
export const add = (_a: Vec2, _b: Vec2): Vec2 => ni('add');
export const sub = (_a: Vec2, _b: Vec2): Vec2 => ni('sub');
export const scale = (_a: Vec2, _k: number): Vec2 => ni('scale');
export const dot = (_a: Vec2, _b: Vec2): number => ni('dot');
export const length = (_a: Vec2): number => ni('length');
export const normalize = (_a: Vec2): Vec2 => ni('normalize');
export const degToRad = (_deg: number): number => ni('degToRad');
/** Wraps an angle into (-180, 180]. */
export const wrapDeg = (_deg: number): number => ni('wrapDeg');
/** Unit direction for a heading in degrees (0° = +y, clockwise positive). */
export const dirFromHeading = (_deg: number): Vec2 => ni('dirFromHeading');
/** Heading in degrees from `from` towards `to`, in (-180, 180]. */
export const bearingDeg = (_from: Vec2, _to: Vec2): number => ni('bearingDeg');
/** Distance along a unit ray to the segment, or null if it misses (parallel counts as a miss). */
export const raySegment = (_origin: Vec2, _dir: Vec2, _seg: Segment): number | null => ni('raySegment');
/** Distance along a unit ray to the first crossing of the circle, or null. */
export const rayCircle = (_origin: Vec2, _dir: Vec2, _c: Vec2, _r: number): number | null => ni('rayCircle');
/** Unit normal of a segment (either side; callers use |dot|). */
export const segmentNormal = (_seg: Segment): Vec2 => ni('segmentNormal');
/** Shortest distance from a point to a segment a–b. */
export const distPointToSegment = (_p: Vec2, _a: Vec2, _b: Vec2): number => ni('distPointToSegment');

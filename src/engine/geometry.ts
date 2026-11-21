// Vector maths and ray intersection. Pure: no DOM, audio or store imports.
// Angle convention: 0° = +y, clockwise positive, so direction = (sin θ, cos θ).
import { HIT_EPSILON_M } from '../config';
import type { Segment, Vec2 } from '../types';

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const normalize = (a: Vec2): Vec2 => {
  const magnitude = length(a);
  return magnitude === 0 ? vec(0, 0) : scale(a, 1 / magnitude);
};
export const degToRad = (deg: number): number => deg * Math.PI / 180;
/** Wraps an angle into (-180, 180]. */
export const wrapDeg = (deg: number): number => {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
};
/** Unit direction for a heading in degrees (0° = +y, clockwise positive). */
export const dirFromHeading = (deg: number): Vec2 => {
  const radians = degToRad(deg);
  return vec(Math.sin(radians), Math.cos(radians));
};
/** Heading in degrees from `from` towards `to`, in (-180, 180]. */
export const bearingDeg = (from: Vec2, to: Vec2): number =>
  wrapDeg(Math.atan2(to.x - from.x, to.y - from.y) * 180 / Math.PI);
/** Distance along a unit ray to the segment, or null if it misses (parallel counts as a miss). */
export const raySegment = (origin: Vec2, dir: Vec2, seg: Segment): number | null => {
  const sx = seg.b.x - seg.a.x;
  const sy = seg.b.y - seg.a.y;
  const denominator = dir.x * sy - dir.y * sx;
  if (denominator === 0) return null;
  const ax = seg.a.x - origin.x;
  const ay = seg.a.y - origin.y;
  const t = (ax * sy - ay * sx) / denominator;
  const u = (ax * dir.y - ay * dir.x) / denominator;
  return t > HIT_EPSILON_M && u >= 0 && u <= 1 ? t : null;
};
/** Distance along a unit ray to the first crossing of the circle, or null. */
export const rayCircle = (origin: Vec2, dir: Vec2, c: Vec2, r: number): number | null => {
  const ox = origin.x - c.x;
  const oy = origin.y - c.y;
  const projection = ox * dir.x + oy * dir.y;
  const discriminant = projection * projection - (ox * ox + oy * oy - r * r);
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const near = -projection - root;
  if (near > HIT_EPSILON_M) return near;
  const far = -projection + root;
  return far > HIT_EPSILON_M ? far : null;
};
/** Unit normal of a segment (either side; callers use |dot|). */
export const segmentNormal = (seg: Segment): Vec2 =>
  normalize(vec(seg.a.y - seg.b.y, seg.b.x - seg.a.x));
/** Shortest distance from a point to a segment a–b. */
export const distPointToSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const squaredLength = dx * dx + dy * dy;
  const t = squaredLength === 0 ? 0 :
    Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / squaredLength));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

// Exact path distance prevents short steps from skipping thin walls or pole edges.
export const distSegmentToSegment = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): number => {
  const bx = b.x - a.x;
  const by = b.y - a.y;
  const dx = d.x - c.x;
  const dy = d.y - c.y;
  const cx = c.x - a.x;
  const cy = c.y - a.y;
  const denominator = bx * dy - by * dx;
  if (denominator !== 0) {
    const t = (cx * dy - cy * dx) / denominator;
    const u = (cx * by - cy * bx) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(
    distPointToSegment(a, c, d), distPointToSegment(b, c, d),
    distPointToSegment(c, a, b), distPointToSegment(d, a, b),
  );
};

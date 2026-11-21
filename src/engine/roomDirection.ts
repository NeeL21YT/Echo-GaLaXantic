// Which way the phone was facing when it measured (§13.6 direction pass). Pure: no DOM, audio or store imports.
// One phone microphone cannot tell which way an echo came from, and the mic pair's axis runs along the phone, so
// these headings only say how the phone was held. Everything spoken about them is worded that way.
import { HEADING } from '../config';
import { wrapDeg } from './geometry';

/** A distance measured while the phone faced `headingDeg` (compass degrees, clockwise). */
export type DirectedRange = { headingDeg: number; distanceM: number };

/** Wraps a heading into 0..360. */
export function normaliseHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Heading of the phone's top edge from a `deviceorientation` reading, or null when the phone is too steep to trust.
 * In the W3C frame (x east, y north, z up) the top edge points along (-sin a cos b, cos a cos b), so the heading is
 * that vector's bearing. Roll does not move the top edge, so a phone held at chest height still reads steadily.
 */
export function headingFromOrientation(alphaDeg: number, betaDeg: number): number | null {
  const alpha = alphaDeg * Math.PI / 180;
  const horizontal = Math.cos(betaDeg * Math.PI / 180);
  if (!Number.isFinite(horizontal) || Math.abs(horizontal) < HEADING.minHorizontal) return null;
  const east = -Math.sin(alpha) * horizontal;
  const north = Math.cos(alpha) * horizontal;
  return normaliseHeading(Math.atan2(east, north) * 180 / Math.PI);
}

/** Turn from one heading to another, in (-180, 180]. Positive is clockwise, that is to the learner's right. */
export function signedTurn(fromDeg: number, toDeg: number): number {
  return wrapDeg(toDeg - fromDeg);
}

/** True when two headings point the same way, allowing for sensor noise. */
export function sameDirection(aDeg: number, bDeg: number): boolean {
  return Math.abs(signedTurn(aDeg, bDeg)) < HEADING.sameDirectionDeg;
}

/** The nearest reading, or null when none were taken. Ties keep the earlier reading. */
export function nearestReading(readings: readonly DirectedRange[]): DirectedRange | null {
  let nearest: DirectedRange | null = null;
  for (const reading of readings) {
    if (!nearest || reading.distanceM < nearest.distanceM) nearest = reading;
  }
  return nearest;
}

/** How many distinct directions the readings cover; a reading within the tolerance of an earlier one counts as the
 *  same direction, so turning back to a wall twice is still one direction. */
export function directionsMeasured(readings: readonly DirectedRange[]): number {
  const headings: number[] = [];
  for (const reading of readings) {
    if (!headings.some(heading => sameDirection(heading, reading.headingDeg))) headings.push(reading.headingDeg);
  }
  return headings.length;
}

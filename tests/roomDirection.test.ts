import { describe, expect, it } from 'vitest';
import {
  directionsMeasured, headingFromOrientation, nearestReading, normaliseHeading, sameDirection, signedTurn,
  type DirectedRange,
} from '../src/engine/roomDirection';

const reading = (headingDeg: number, distanceM: number): DirectedRange => ({ headingDeg, distanceM });

describe('normaliseHeading', () => {
  it('wraps into 0..360', () => {
    expect(normaliseHeading(0)).toBe(0);
    expect(normaliseHeading(-90)).toBe(270);
    expect(normaliseHeading(450)).toBe(90);
    expect(normaliseHeading(360)).toBe(0);
  });
});

describe('headingFromOrientation', () => {
  it('turns the other way from alpha, so a left turn reads as a lower compass heading', () => {
    expect(headingFromOrientation(0, 0)).toBeCloseTo(0, 6);
    expect(headingFromOrientation(90, 0)).toBeCloseTo(270, 6);
    expect(headingFromOrientation(45, 0)).toBeCloseTo(315, 6);
  });

  it('holds the same heading when the phone is tilted to chest height', () => {
    // Roll and tilt should not swing the reading; the top edge still points the same way across the room.
    expect(headingFromOrientation(30, 60)).toBeCloseTo(headingFromOrientation(30, 0)!, 6);
    expect(headingFromOrientation(200, -45)).toBeCloseTo(headingFromOrientation(200, 0)!, 6);
  });

  it('refuses a phone held nearly straight up or down, where the heading is unstable', () => {
    expect(headingFromOrientation(0, 90)).toBeNull();
    expect(headingFromOrientation(0, -90)).toBeNull();
    expect(headingFromOrientation(0, Number.NaN)).toBeNull();
  });
});

describe('signedTurn', () => {
  it('is positive clockwise and survives the wrap', () => {
    expect(signedTurn(350, 10)).toBe(20);
    expect(signedTurn(10, 350)).toBe(-20);
    expect(signedTurn(0, 180)).toBe(180);
    expect(signedTurn(90, 90)).toBe(0);
  });
});

describe('sameDirection', () => {
  it('allows sensor noise but not a real turn', () => {
    expect(sameDirection(0, 15)).toBe(true);
    expect(sameDirection(355, 5)).toBe(true);
    expect(sameDirection(0, 25)).toBe(false);
    expect(sameDirection(90, 270)).toBe(false);
  });
});

describe('nearestReading', () => {
  it('picks the closest distance and copes with an empty list', () => {
    expect(nearestReading([])).toBeNull();
    expect(nearestReading([reading(0, 2.4), reading(90, 1.1), reading(180, 3)])).toEqual(reading(90, 1.1));
  });
});

describe('directionsMeasured', () => {
  it('counts a direction once however often it was pinged', () => {
    expect(directionsMeasured([])).toBe(0);
    expect(directionsMeasured([reading(0, 2), reading(10, 2.1), reading(180, 1)])).toBe(2);
    expect(directionsMeasured([reading(0, 2), reading(90, 1), reading(180, 3), reading(270, 2.5)])).toBe(4);
  });
});

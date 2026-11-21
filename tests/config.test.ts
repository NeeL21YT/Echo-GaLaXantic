import { describe, expect, it } from 'vitest';
import * as C from '../src/config';

describe('config', () => {
  it('has one ray every 5 degrees', () => {
    expect(C.RAY_COUNT * C.RAY_STEP_DEG).toBe(360);
    expect(C.RAY_STEP_DEG).toBe(5);
  });

  it('has a default stretch that is one of the steps', () => {
    expect(C.STRETCH_STEPS).toContain(C.DEFAULT_STRETCH);
  });

  it('keeps the minimum distance inside the range', () => {
    expect(C.MIN_DIST_M).toBeGreaterThan(0);
    expect(C.MIN_DIST_M).toBeLessThan(C.MAX_RANGE_M);
  });
});

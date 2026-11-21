import { describe, expect, it } from 'vitest';
import { nextScanIndex } from '../src/input/menuScan';

describe('nextScanIndex', () => {
  it('starts on the first option', () => {
    expect(nextScanIndex(-1, 12)).toBe(0);
  });
  it('steps forward', () => {
    expect(nextScanIndex(3, 12)).toBe(4);
  });
  it('wraps from the last option to the first', () => {
    expect(nextScanIndex(11, 12)).toBe(0);
  });
  it('has nowhere to go with no options', () => {
    expect(nextScanIndex(-1, 0)).toBe(-1);
  });
});

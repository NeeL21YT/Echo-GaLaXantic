import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle } from '../src/engine/rng';

describe('mulberry32', () => {
  it('reproduces the same sequence for the same seed', () => {
    const first = mulberry32(12345);
    const second = mulberry32(12345);
    expect(Array.from({ length: 100 }, first)).toEqual(Array.from({ length: 100 }, second));
  });
  it('matches the standard algorithm sequence for seed 1', () => {
    const rng = mulberry32(1);
    expect(Array.from({ length: 4 }, rng)).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741,
    ]);
  });
  it('uses uint32 seeds and keeps outputs in [0,1)', () => {
    const negative = mulberry32(-1);
    const unsigned = mulberry32(0xffffffff);
    expect(Array.from({ length: 20 }, negative)).toEqual(Array.from({ length: 20 }, unsigned));
    const rng = mulberry32(0);
    const values = Array.from({ length: 1000 }, rng);
    expect(values.every(value => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
  it('gives different sequences for different seeds', () => {
    const first = mulberry32(1);
    const second = mulberry32(2);
    expect(Array.from({ length: 10 }, first)).not.toEqual(Array.from({ length: 10 }, second));
  });
});

describe('shuffle', () => {
  it('keeps every element and does not mutate the input', () => {
    const items = Object.freeze([1, 2, 2, 3, 4, 5]);
    const shuffled = shuffle(items, mulberry32(42));
    expect([...shuffled].sort()).toEqual([...items].sort());
    expect(items).toEqual([1, 2, 2, 3, 4, 5]);
    expect(shuffled).not.toBe(items);
    expect(shuffled).toEqual(shuffle(items, mulberry32(42)));
  });
  it('uses Fisher-Yates including index zero and the current last index', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([1, 2, 3, 4], () => 1 - Number.EPSILON)).toEqual([1, 2, 3, 4]);
  });
  it('handles empty and singleton inputs without consuming randomness', () => {
    const unused = (): number => { throw new Error('RNG should not be needed'); };
    expect(shuffle([], unused)).toEqual([]);
    expect(shuffle(['only'], unused)).toEqual(['only']);
  });
});

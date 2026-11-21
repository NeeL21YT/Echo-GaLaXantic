import { MULBERRY32 } from '../config';

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + MULBERRY32.increment) >>> 0;
    let value = Math.imul(state ^ (state >>> MULBERRY32.firstShift), state | 1);
    value ^= value + Math.imul(value ^ (value >>> MULBERRY32.secondShift), value | MULBERRY32.mixMask);
    return ((value ^ (value >>> MULBERRY32.finalShift)) >>> 0) / MULBERRY32.uint32Range;
  };
}

/** Fisher–Yates shuffle using the given RNG; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // Both indices are inside the copied array because the RNG returns values in [0,1).
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

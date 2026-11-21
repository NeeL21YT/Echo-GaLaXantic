// Seeded RNG so every trial can be reproduced from its seed.

export function mulberry32(_seed: number): () => number {
  throw new Error('not implemented: mulberry32');
}

/** Fisher–Yates shuffle using the given RNG; returns a new array. */
export function shuffle<T>(_items: readonly T[], _rng: () => number): T[] {
  throw new Error('not implemented: shuffle');
}

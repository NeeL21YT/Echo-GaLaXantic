import type { EchoVoice, Hit } from '../types';

/** One echo voice from the deck formulas (build_spec §5.3). */
export function makeVoice(
  _d: number,
  _azDeg: number,
  _reflectance: number,
  _cosTheta: number,
  _stretch: number,
): EchoVoice {
  throw new Error('not implemented: makeVoice');
}

/** Hits → merged voices (≤ MAX_VOICES), sorted by gain descending. */
export function buildEchoes(_hits: Hit[], _stretch: number): EchoVoice[] {
  throw new Error('not implemented: buildEchoes');
}

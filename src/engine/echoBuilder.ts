import {
  ECHO_GAIN_SCALE, LOWPASS_NUMERATOR_HZ, MAX_VOICES, MERGE_AZ_BIN_DEG,
  MERGE_DIST_BIN_M, MIN_DIST_M, SPEED_OF_SOUND,
} from '../config';
import type { EchoVoice, Hit } from '../types';
import { degToRad, wrapDeg } from './geometry';

/** One echo voice from the deck formulas (build_spec §5.3). */
export function makeVoice(
  d: number,
  azDeg: number,
  reflectance: number,
  cosTheta: number,
  stretch: number,
): EchoVoice {
  const distance = Math.max(d, MIN_DIST_M);
  return {
    d: distance,
    delayS: (2 * distance / SPEED_OF_SOUND) * stretch,
    gain: reflectance * cosTheta * (1 / 2) / (2 * distance) * ECHO_GAIN_SCALE,
    cutoffHz: LOWPASS_NUMERATOR_HZ / (1 + distance),
    azDeg,
  };
}

/** Hits → merged voices (≤ MAX_VOICES), sorted by gain descending. */
export function buildEchoes(hits: Hit[], stretch: number): EchoVoice[] {
  const nBins = 360 / MERGE_AZ_BIN_DEG;
  const bins = new Map<string, {
    kind: Hit['kind']; gainSum: number; gainSquared: number; distanceSum: number; sinSum: number; cosSum: number;
  }>();
  for (const hit of hits) {
    const voice = makeVoice(hit.d, hit.relAzDeg, hit.reflectance, hit.cosTheta, stretch);
    if (voice.gain === 0) continue;
    const azBin = ((Math.round(voice.azDeg / MERGE_AZ_BIN_DEG) % nBins) + nBins) % nBins;
    // Poles never merge into wall bins, so a small object keeps its own short, weak echo.
    const key = `${hit.kind},${azBin},${Math.round(voice.d / MERGE_DIST_BIN_M)}`;
    let bin = bins.get(key);
    if (!bin) {
      bin = { kind: hit.kind, gainSum: 0, gainSquared: 0, distanceSum: 0, sinSum: 0, cosSum: 0 };
      bins.set(key, bin);
    }
    const radians = degToRad(voice.azDeg);
    bin.gainSum += voice.gain;
    bin.gainSquared += voice.gain * voice.gain;
    bin.distanceSum += voice.gain * voice.d;
    bin.sinSum += voice.gain * Math.sin(radians);
    bin.cosSum += voice.gain * Math.cos(radians);
  }
  const poleVoices: EchoVoice[] = [];
  const wallVoices: EchoVoice[] = [];
  for (const bin of bins.values()) {
    const d = bin.distanceSum / bin.gainSum;
    const az = wrapDeg(Math.atan2(bin.sinSum, bin.cosSum) * 180 / Math.PI);
    const voice = makeVoice(d, az, 1, 1, stretch);
    // The bin already contains reflected energy; applying attenuation again would lose it.
    voice.gain = Math.sqrt(bin.gainSquared);
    (bin.kind === 'pole' ? poleVoices : wallVoices).push(voice);
  }
  const byGain = (a: EchoVoice, b: EchoVoice) => b.gain - a.gain || a.d - b.d;
  // The voice cap is a rendering budget, not acoustics: pole echoes are reserved first so the cap can't
  // silently delete the one cue Level 4 teaches; the strongest wall echoes fill the remaining slots.
  const poles = poleVoices.sort(byGain).slice(0, MAX_VOICES);
  const walls = wallVoices.sort(byGain).slice(0, MAX_VOICES - poles.length);
  return [...poles, ...walls].sort(byGain);
}

// Pure Morse encoding (§13.4). Output devices (vibration, tone) live in audio/morsePlayer.ts.
import { MORSE } from '../config';

const CODES: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
};

/** Dots and dashes for one text, letters separated by a space and words by " / ". Unknown characters are skipped. */
export function toMorse(text: string): string {
  return text
    .toUpperCase()
    .split(/\s+/)
    .map((word) =>
      [...word]
        .map((ch) => CODES[ch])
        .filter((code): code is string => code !== undefined)
        .join(' '),
    )
    .filter((word) => word.length > 0)
    .join(' / ');
}

/**
 * Alternating on/off durations in ms, starting with "on" — the shape navigator.vibrate expects.
 * Dash = 3 units, gaps inside a letter = 1, between letters = 3, between words = 7. No trailing gap.
 */
export function morseTimings(text: string, unitMs: number = MORSE.unitMs): number[] {
  const out: number[] = [];
  const addOn = (units: number) => out.push(units * unitMs);
  const addOff = (units: number) => {
    if (out.length === 0) return;
    // Merge into the previous gap if one is already open, so on/off strictly alternate.
    if (out.length % 2 === 0) out[out.length - 1] = (out[out.length - 1] ?? 0) + units * unitMs;
    else out.push(units * unitMs);
  };
  const words = toMorse(text).split(' / ');
  words.forEach((word, wi) => {
    if (word.length === 0) return;
    if (wi > 0) addOff(7);
    word.split(' ').forEach((letter, li) => {
      if (li > 0) addOff(3);
      [...letter].forEach((symbol, si) => {
        if (si > 0) addOff(1);
        addOn(symbol === '.' ? 1 : 3);
      });
    });
  });
  return out;
}

/** Total length of a timing pattern in ms. */
export function totalMs(timings: readonly number[]): number {
  return timings.reduce((sum, t) => sum + t, 0);
}

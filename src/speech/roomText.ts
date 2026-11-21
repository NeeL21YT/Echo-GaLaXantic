// What the real-room check says (§13.6). Pure so the wording and the fade rule can be tested.
import { RANGING } from '../config';
import type { InputStyle } from './inputText';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/** Distances as a voice would say them: "half a metre", "one and a half metres", "one point eight metres". */
export function metres(m: number): string {
  const tenths = Math.round(m * 10);
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  if (tenths === 5) return 'half a metre';
  if (frac === 0) return `${word(whole)} ${whole === 1 ? 'metre' : 'metres'}`;
  if (frac === 5) return `${word(whole)} and a half metres`;
  return `${word(whole)} point ${word(frac)} metres`;
}

export type GuessJudgement = {
  close: boolean;
  /** Spoken straight after the guess. */
  now: string;
  /** Spoken only when the learner asks, or at once while hints are not yet faded. */
  reveal: string;
};

/** What to press to get the measured number again, in the learner's own words. */
function numberAgain(style: InputStyle): string {
  if (style === 'keys') return 'Press R to hear the number.';
  return style === 'touch' ? 'Double tap to hear the number.' : 'Choose Tell me the distance to hear the number.';
}

/** After `passesToFade` close guesses in a row the number is held back until the learner asks. */
export function judgeGuess(guessM: number, actualM: number, closeStreakBefore: number, style: InputStyle = 'buttons'): GuessJudgement {
  const diff = Math.abs(guessM - actualM);
  const close = diff <= RANGING.closeToleranceM;
  const gap = Math.round(diff * 10) / 10;
  const difference = gap === 0 ? 'You were spot on.' : `You were ${metres(diff)} ${guessM > actualM ? 'too far' : 'too near'}.`;
  const reveal = `You guessed ${metres(guessM)}. The wall was ${metres(actualM)} away. ${difference}`;
  const faded = closeStreakBefore >= RANGING.passesToFade;
  const verdict = close ? 'Close.' : `Off by more than ${metres(RANGING.closeToleranceM)}.`;
  if (!faded) return { close, reveal, now: `${reveal} ${verdict}` };
  return { close, reveal, now: `${verdict} ${numberAgain(style)}` };
}

export function guessPrompt(guessM: number): string {
  return `Your guess is ${metres(guessM)}.`;
}

const PING_WORDS: Record<InputStyle, string> = {
  keys: 'Press Space to ping.',
  touch: 'Tap to ping.',
  buttons: 'Choose Click to ping.',
};

/** The introduction as short messages, so none is too long to take in at once. */
export function roomIntro(style: InputStyle): string[] {
  return [
    'Real room check. Unplug your headphones, so the phone speaker is used.',
    `Face a wall one to five metres away. Hold the phone at chest height. ${PING_WORDS[style]}`,
    'Then guess how far the wall is before I tell you. Echo is practice, not a navigation aid. Keep using your cane or a friend.',
  ];
}

/** What to press to change and lock in the guess. */
export function guessHelp(style: InputStyle): string {
  if (style === 'keys') return 'Press 2 for far to add half a metre, or 1 for near to take half a metre away. Press Enter to lock in your guess.';
  if (style === 'touch') return 'Swipe up for far to add half a metre, or down for near to take half a metre away. Press and hold to lock in your guess.';
  return 'Choose Far to add half a metre, or Near to take half a metre away. Choose Lock in my guess when you are ready.';
}

/** Said after the reveal, so the learner knows how to go on. */
export function revealHint(style: InputStyle): string {
  if (style === 'keys') return 'Press N to try again, or R to hear the numbers again.';
  if (style === 'touch') return 'Press and hold to try again, or double tap to hear the numbers again.';
  return 'Choose Try again, or Tell me the distance to hear the numbers again.';
}

export function tryAgainPrompt(style: InputStyle): string {
  if (style === 'keys') return 'Move or turn, then press Space to ping.';
  return style === 'touch' ? 'Move or turn, then tap to ping.' : 'Move or turn, then choose Click to ping.';
}

export const ROOM_LISTENING = 'Listening. Stay still and quiet.';

export function noWall(failsInRow: number, tipAfter: number): string {
  const base = 'I could not find a wall. Face a wall within five metres, keep the phone steady, and ping again.';
  return failsInRow >= tipAfter
    ? `${base} A hard, flat wall works best. Turn off fans and ask anyone nearby to stay quiet.`
    : base;
}

export const ROOM_MIC_BLOCKED = 'The microphone is blocked, so I cannot measure. Allow the microphone for Echo, then try again.';

/** Said when a ping is pressed while one is already running. */
export const ROOM_BUSY = 'Still listening.';

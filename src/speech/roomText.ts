// What the real-room check says (§13.6). Pure so the wording and the fade rule can be tested.
import { HEADING, RANGING } from '../config';
import {
  directionsMeasured, nearestReading, signedTurn, type DirectedRange,
} from '../engine/roomDirection';
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
    `Face a wall one to five metres away. Hold the phone flat at chest height, top edge pointing at the wall. ${PING_WORDS[style]}`,
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

// Direction pass (§13.6). A phone with one microphone cannot hear which way an echo came from, so these lines only
// ever describe which way the phone faced. They say so out loud rather than leaving the learner to guess.
const DEGREE_WORDS: Record<number, string> = {
  15: 'about fifteen degrees',
  30: 'about thirty degrees',
  45: 'about forty-five degrees',
  60: 'about sixty degrees',
  75: 'about seventy-five degrees',
  90: 'about ninety degrees',
  105: 'about one hundred and five degrees',
  120: 'about one hundred and twenty degrees',
  135: 'about one hundred and thirty-five degrees',
};

/** A rounded turn as words; the rounding keeps the claim no finer than a step of the feet. */
function turnWords(magnitudeDeg: number): string {
  const rounded = Math.round(magnitudeDeg / HEADING.turnRoundDeg) * HEADING.turnRoundDeg;
  return DEGREE_WORDS[rounded] ?? `about ${rounded} degrees`;
}

/** Said once, on the first ping that had a heading, so the direction pass is never a silent surprise, and so the
 *  learner knows the hold it needs: the heading comes from the phone's top edge, which needs the phone fairly flat. */
export const HEADING_FIRST_PING =
  'Your phone is flat, so I can tell which way it faces. Turn between pings and I will compare directions. I know the way the phone faces, not the way the echo came.';

/** The net turn since the last measurement, in words. A failed ping has no direction, so this compares with the
 *  last ping that actually measured something. */
export function spokenTurn(turnDeg: number): string {
  const magnitude = Math.abs(turnDeg);
  if (magnitude < HEADING.sameDirectionDeg) return 'You are facing the same way as your last measurement.';
  if (magnitude >= HEADING.turnAroundDeg) return 'You turned around since your last measurement.';
  return `You turned ${turnWords(magnitude)} to your ${turnDeg < 0 ? 'left' : 'right'} since your last measurement.`;
}

/** Which way a reading was taken, relative to the way the learner first faced this visit. */
export function facingWords(turnDeg: number): string {
  const magnitude = Math.abs(turnDeg);
  const first = 'the way you first faced';
  if (magnitude < HEADING.sameDirectionDeg) return first;
  if (magnitude >= HEADING.turnAroundDeg) return `the opposite of ${first}`;
  return `${turnWords(magnitude)} to your ${turnDeg < 0 ? 'left' : 'right'} of ${first}`;
}

/** The nearest reading of the visit, named by the way the phone faced for it, or null until two directions are in.
 *  Only spoken when the learner asks, so the reveal stays short. */
export function nearestDirectionNote(readings: readonly DirectedRange[], firstHeadingDeg: number | null): string | null {
  const nearest = nearestReading(readings);
  if (!nearest || firstHeadingDeg === null || directionsMeasured(readings) < HEADING.directionsForSummary) return null;
  const facing = facingWords(signedTurn(firstHeadingDeg, nearest.headingDeg));
  return `Nearest reading so far: ${metres(nearest.distanceM)}, taken while you faced ${facing}. The distance is to the nearest surface, whichever side of you it was on.`;
}

export const ROOM_LISTENING = 'Listening. Stay still and quiet.';

/** Said with the reveal when the pings did not agree, so a middle-of-the-road number is never presented as a
 *  measurement. Nothing about the guess is judged differently: only the claim about the room is softened. */
export const ROOM_ROUGH = 'My pings disagreed in this room, so that distance is rough.';

/** Said once per visit when the phone reports that it is filtering the microphone anyway. */
export const ROOM_FILTERED = 'Your phone is filtering its microphone, so these distances may be wrong.';

export function noWall(failsInRow: number, tipAfter: number): string {
  const base = 'I could not find a wall. Face a wall within five metres, keep the phone steady, and ping again.';
  return failsInRow >= tipAfter
    ? `${base} A hard, flat wall works best. Turn off fans and ask anyone nearby to stay quiet.`
    : base;
}

export const ROOM_MIC_BLOCKED = 'The microphone is blocked, so I cannot measure. Allow the microphone for Echo, then try again.';

/** Said when a ping is pressed while one is already running. */
export const ROOM_BUSY = 'Still listening.';

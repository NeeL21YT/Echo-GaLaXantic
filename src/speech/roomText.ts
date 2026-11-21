// What the real-room check says (§13.6). Pure so the wording and the fade rule can be tested.
import { RANGING } from '../config';

const metres = (m: number): string => `${(Math.round(m * 10) / 10).toString()} ${Math.round(m * 10) === 10 ? 'metre' : 'metres'}`;

export type GuessJudgement = {
  close: boolean;
  /** Spoken straight after the guess. */
  now: string;
  /** Spoken only when the learner asks, or at once while hints are not yet faded. */
  reveal: string;
};

/** After `passesToFade` close guesses in a row the number is held back until the learner asks. */
export function judgeGuess(guessM: number, actualM: number, closeStreakBefore: number): GuessJudgement {
  const diff = Math.abs(guessM - actualM);
  const close = diff <= RANGING.closeToleranceM;
  const reveal = `You guessed ${metres(guessM)}. The wall was ${metres(actualM)} away.`;
  const faded = closeStreakBefore >= RANGING.passesToFade;
  const verdict = close ? 'Close.' : `Off by more than ${metres(RANGING.closeToleranceM)}.`;
  if (!faded) return { close, reveal, now: `${reveal} ${verdict}` };
  return { close, reveal, now: `${verdict} Press Tell me the distance if you want the number.` };
}

export function guessPrompt(guessM: number): string {
  return `Your guess is ${metres(guessM)}.`;
}

export const ROOM_INTRO =
  'Real room check. Unplug your headphones so the phone speaker is used. Face a wall one to five metres away and hold the phone at chest height. Press Click to ping. Then guess how far the wall is before I tell you.';

export const ROOM_GUESS_HELP =
  'Press Farther to add half a metre, or Closer to take half a metre away. Press Lock in my guess when you are ready.';

export const ROOM_NO_WALL =
  'I could not find a wall. Face a wall within five metres, keep the phone steady, and click again.';

export const ROOM_MIC_BLOCKED = 'The microphone is blocked, so I cannot measure. Allow the microphone for Echo, then try again.';

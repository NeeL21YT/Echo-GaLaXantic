// Real-room check flow (§13.6): ping → guess first → reveal → fade. Teaches the ear; the phone only checks the answer.
// The microphone is open for the whole visit and must be released on every way out, including a Back pressed mid-ping.
import { RANGING, ROOM_FAILS_BEFORE_TIP } from '../config';
import { closeRanger, measureNearestSurface, openRanger } from '../audio/ranger';
import { stopAll } from '../audio/player';
import type { Range } from '../engine/ranging';
import { signedTurn, type DirectedRange } from '../engine/roomDirection';
import { currentHeading, startCompass, stopCompass } from '../input/compass';
import { currentInputStyle } from '../input/inputStyle';
import {
  guessHelp, guessPrompt, HEADING_FIRST_PING, judgeGuess, nearestDirectionNote, noWall, revealHint, ROOM_LISTENING,
  ROOM_MIC_BLOCKED, roomIntro, spokenTurn, tryAgainPrompt,
  type GuessJudgement,
} from '../speech/roomText';
import { cancel } from '../speech/narrator';
import { ensureMicPermission, goToLevelSelect, say, silenceSpeech } from './runner';
import { sayAndSettle, settleMicRefusal } from './settle';
import { useEcho, type Action } from './store';

const S = () => useEcho.getState();

type Sub = 'idle' | 'pinged' | 'revealed';
let sub: Sub = 'idle';
let range: Range | null = null;
let guess: number = RANGING.guessStartM;
let closeStreak = 0;
let failsInRow = 0;
let lastJudgement: GuessJudgement | null = null;
let busy = false;
// Direction pass (§13.6): the way the phone faced at each measured ping, plus the first facing as the reference.
// Empty when the phone has no heading sensor, and then nothing about direction is ever said.
let readings: DirectedRange[] = [];
let firstHeading: number | null = null;
let lastHeading: number | null = null;
let headingExplained = false;
/** Bumped on every visit and every exit, so a ping still running from an earlier visit speaks and changes nothing. */
let visit = 0;
/** Bumped whenever the room speaks something new, so an introduction still being read stops at once. */
let speaking = 0;

/** Says one message, replacing whatever the introduction was still reading. */
function tell(text: string, opts: { isError?: boolean } = {}): Promise<void> {
  speaking++;
  return say(text, opts);
}

/** Reads the introduction as short messages, one after the other, unless something else is said meanwhile. */
async function tellIntro(): Promise<void> {
  const mine = ++speaking;
  const stillMine = () => mine === speaking;
  for (const message of roomIntro(currentInputStyle())) {
    if (!stillMine()) return;
    await sayAndSettle(message, stillMine);
  }
}

/** Buttons depend on the sub-state, so every change bumps a store counter to re-render them. */
function changed(): void {
  S().patch({ roomStep: S().roomStep + 1 });
}

export function startRoom(): void {
  visit++;
  sub = 'idle';
  range = null;
  guess = RANGING.guessStartM;
  failsInRow = 0;
  lastJudgement = null;
  readings = [];
  firstHeading = null;
  lastHeading = null;
  headingExplained = false;
  startCompass();
  stopAll();
  S().patch({ phase: 'realRoom', levelId: null, lessonId: null, trial: null, lastHits: [], lastPose: null });
  changed();
  void tellIntro();
}

async function ping(): Promise<void> {
  if (busy) return;
  busy = true;
  speaking++; // a pinged room must not still be reading its introduction
  const mine = visit;
  const here = () => mine === visit && S().phase === 'realRoom';
  try {
    if (!(await ensureMicPermission())) {
      await settleMicRefusal(here);
      return;
    }
    if (!here()) return;
    try {
      await openRanger();
    } catch {
      // Leaving while the permission prompt was open also lands here; that is not a refusal.
      if (here()) await sayAndSettle(ROOM_MIC_BLOCKED, here, { isError: true });
      return;
    }
    if (!here()) {
      closeRanger();
      return;
    }
    await sayAndSettle(ROOM_LISTENING, here);
    await silenceSpeech();
    if (!here()) return;
    const found = await measureNearestSurface();
    if (!here()) return; // left while measuring
    if (!found) {
      failsInRow += 1;
      sub = 'idle';
      changed();
      await tell(noWall(failsInRow, ROOM_FAILS_BEFORE_TIP));
      return;
    }
    failsInRow = 0;
    range = found;
    guess = RANGING.guessStartM;
    // The heading is read before the reveal is spoken, while the learner still stands the way they pinged.
    const heading = currentHeading();
    const turn = heading !== null && lastHeading !== null ? signedTurn(lastHeading, heading) : null;
    if (heading !== null) {
      readings.push({ headingDeg: heading, distanceM: found.distanceM });
      firstHeading = firstHeading ?? heading;
      lastHeading = heading;
    }
    const style = currentInputStyle();
    const said = ['Got it.'];
    if (heading !== null && !headingExplained) {
      headingExplained = true;
      said.push(HEADING_FIRST_PING);
    }
    if (turn !== null) said.push(spokenTurn(turn));
    said.push(guessPrompt(guess), guessHelp(style));
    sub = 'pinged';
    changed();
    await tell(said.join(' '));
  } catch (err) {
    console.error(err);
    if (here()) void tell('Something went wrong with that ping. Try again.', { isError: true });
  } finally {
    busy = false;
  }
}

function adjust(deltaM: number): void {
  const next = Math.min(RANGING.guessMaxM, Math.max(RANGING.guessStepM, guess + deltaM));
  const atLimit = next === guess;
  guess = next;
  const limit = deltaM > 0 ? 'That is as far as I measure.' : 'That is as near as I measure.';
  void tell(atLimit ? `${guessPrompt(guess)} ${limit}` : guessPrompt(guess));
}

function lockIn(): void {
  if (!range) return;
  const style = currentInputStyle();
  lastJudgement = judgeGuess(guess, range.distanceM, closeStreak, style);
  closeStreak = lastJudgement.close ? closeStreak + 1 : 0;
  sub = 'revealed';
  changed();
  void tell(`${lastJudgement.now} ${revealHint(style)}`);
}

/** Releases everything the check holds: the microphone, the chirp, speech, and any ping still in flight. */
export function abortRoom(): void {
  visit++;
  speaking++;
  stopCompass();
  readings = [];
  firstHeading = null;
  lastHeading = null;
  headingExplained = false;
  closeRanger();
  stopAll();
  cancel();
  sub = 'idle';
  changed();
}

function leave(): void {
  abortRoom();
  void goToLevelSelect();
}

export function roomAction(action: Action): boolean {
  if (S().phase !== 'realRoom') return false;
  if (action === 'levelSelect') {
    leave();
    return true;
  }
  // While a ping is measuring, any sound or speech of ours would be recorded as if it were an echo.
  if (busy) return true;
  switch (action) {
    case 'click':
      void ping();
      return true;
    case 'far':
    case 'near':
      if (sub !== 'pinged') return false;
      adjust(action === 'far' ? RANGING.guessStepM : -RANGING.guessStepM);
      return true;
    case 'answer':
      if (sub !== 'pinged') return false;
      lockIn();
      return true;
    case 'replay': {
      if (sub !== 'revealed' || !lastJudgement) return false;
      const direction = nearestDirectionNote(readings, firstHeading);
      void tell(direction ? `${lastJudgement.reveal} ${direction}` : lastJudgement.reveal);
      return true;
    }
    case 'next':
      if (sub !== 'revealed') return false;
      sub = 'idle';
      changed();
      void tell(tryAgainPrompt(currentInputStyle()));
      return true;
    case 'help':
      void tellIntro();
      return true;
    default:
      return false;
  }
}

export function roomActions(): Action[] {
  const tail: Action[] = ['help', 'levelSelect'];
  if (sub === 'pinged') return ['far', 'near', 'answer', 'click', ...tail];
  if (sub === 'revealed') return ['replay', 'next', 'click', ...tail];
  return ['click', ...tail];
}

// Real-room check flow (§13.6): ping → guess first → reveal → fade. Teaches the ear; the phone only checks the answer.
import { RANGING } from '../config';
import { closeRanger, measureNearestSurface, openRanger } from '../audio/ranger';
import type { Range } from '../engine/ranging';
import {
  guessPrompt, judgeGuess, ROOM_GUESS_HELP, ROOM_INTRO, ROOM_MIC_BLOCKED, ROOM_NO_WALL, type GuessJudgement,
} from '../speech/roomText';
import { say, silenceSpeech } from './runner';
import { useEcho, type Action } from './store';

const S = () => useEcho.getState();

type Sub = 'idle' | 'pinged' | 'revealed';
let sub: Sub = 'idle';
let range: Range | null = null;
let guess: number = RANGING.guessStartM;
let closeStreak = 0;
let lastJudgement: GuessJudgement | null = null;
let busy = false;

/** Buttons depend on the sub-state, so every change bumps a store counter to re-render them. */
function changed(): void {
  S().patch({ roomStep: S().roomStep + 1 });
}

export function startRoom(): void {
  sub = 'idle';
  range = null;
  guess = RANGING.guessStartM;
  lastJudgement = null;
  S().patch({ phase: 'realRoom', levelId: null, lessonId: null, trial: null, lastHits: [], lastPose: null });
  changed();
  void say(ROOM_INTRO);
}

async function ping(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    try {
      await openRanger();
    } catch {
      await say(ROOM_MIC_BLOCKED, { isError: true });
      return;
    }
    await say('Listening.');
    await silenceSpeech();
    const found = await measureNearestSurface();
    if (S().phase !== 'realRoom') return; // left while measuring
    if (!found) {
      sub = 'idle';
      changed();
      await say(ROOM_NO_WALL);
      return;
    }
    range = found;
    guess = RANGING.guessStartM;
    sub = 'pinged';
    changed();
    await say(`Got it. ${guessPrompt(guess)} ${ROOM_GUESS_HELP}`);
  } finally {
    busy = false;
  }
}

function adjust(deltaM: number): void {
  guess = Math.min(RANGING.guessMaxM, Math.max(RANGING.guessStepM, guess + deltaM));
  void say(guessPrompt(guess));
}

function lockIn(): void {
  if (!range) return;
  lastJudgement = judgeGuess(guess, range.distanceM, closeStreak);
  closeStreak = lastJudgement.close ? closeStreak + 1 : 0;
  sub = 'revealed';
  changed();
  void say(lastJudgement.now);
}

function leave(): void {
  closeRanger();
  S().patch({ phase: 'levelSelect' });
  void say('Choose a lesson or a level.');
}

export function roomAction(action: Action): boolean {
  if (S().phase !== 'realRoom') return false;
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
    case 'replay':
      if (sub !== 'revealed' || !lastJudgement) return false;
      void say(lastJudgement.reveal);
      return true;
    case 'next':
      if (sub !== 'revealed') return false;
      sub = 'idle';
      changed();
      void say('Move or turn, then click again.');
      return true;
    case 'help':
      void say(ROOM_INTRO);
      return true;
    case 'levelSelect':
      leave();
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

// Real-room check flow (§13.6): ping → guess first → reveal → fade. Teaches the ear; the phone only checks the answer.
// The microphone is open for the whole visit and must be released on every way out, including a Back pressed mid-ping.
import { PLACES, RANGING, ROOM_FAILS_BEFORE_TIP } from '../config';
import { audioFiltered, closeRanger, measureNearestSurface, openRanger, takeWasRough } from '../audio/ranger';
import { stopAll } from '../audio/player';
import type { Range } from '../engine/ranging';
import {
  addMark, contradicted, marksAt, matchPlaces, placeHeading, placeLabel, toPlaceReadings,
  type MarkKind, type Place,
} from '../engine/placeMap';
import { normaliseHeading, signedTurn, type DirectedRange } from '../engine/roomDirection';
import {
  markContradiction, markDone, markDuplicate, markPrompt, marksHere, placeAlreadySaved, placeMatched, placeSaved,
  PLACE_NOT_SAVED, placesAlike, placesFull, saveNeedsOneMorePing,
} from '../speech/placeText';
import { getPlaces, savePlaces } from './progress';
import { currentHeading, startCompass, stopCompass } from '../input/compass';
import { currentInputStyle } from '../input/inputStyle';
import {
  guessHelp, guessPrompt, HEADING_FIRST_PING, judgeGuess, nearestDirectionNote, noWall, revealHint, ROOM_FILTERED,
  ROOM_LISTENING, ROOM_MIC_BLOCKED, ROOM_ROUGH, roomIntro,  spokenTurn, tryAgainPrompt,
  type GuessJudgement,
} from '../speech/roomText';
import { cancel } from '../speech/narrator';
import { ensureMicPermission, goToLevelSelect, say, silenceSpeech } from './runner';
import { sayAndSettle, settleMicRefusal } from './settle';
import { useEcho, type Action } from './store';

const S = () => useEcho.getState();

type Sub = 'idle' | 'pinged' | 'revealed' | 'marking';
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
/** True when the last measurement's pings disagreed, so the reveal says the distance is rough. */
let rangeRough = false;
/** The phone-filtering warning is said once per visit, not on every ping. */
let filteredWarned = false;
// Places (§13.6): saved spots and the things marked in them. There is no position sensor, so a place is recognised
// by matching the readings of this spot against the saved signature, never by coordinates.
let places: Place[] = [];
/** The saved place this spot was recognised as, or null when it is not known yet. */
let placeId: string | null = null;
/** Turns a heading taken this visit into the matching heading of the saved place. */
let placeRotation = 0;
/** Index into `readings` where the current standing spot began; Next starts a new one. */
let spotStart = 0;
/** Where Mark returns to when a kind is chosen, so a guess in progress is not lost. */
let markReturnSub: Sub = 'revealed';
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

/** The readings of the current standing spot; a place is made of these, not of the whole visit. */
function spotReadings(): DirectedRange[] {
  return readings.slice(spotStart);
}

/** The facing of the last measurement in the saved place's own frame, or null when there is no heading. */
function placeHeadingNow(): number | null {
  const spot = spotReadings();
  const first = spot[0];
  const last = spot.at(-1);
  if (!first || !last) return null;
  return placeHeading(placeRotation, normaliseHeading(last.headingDeg - first.headingDeg));
}

/** Keeps this spot, or relinks to the saved place it already matches. Two facings are the minimum shape. */
function keepPlace(): void {
  const spot = toPlaceReadings(spotReadings());
  if (spot.length < 2) {
    void tell(saveNeedsOneMorePing());
    return;
  }
  const match = matchPlaces(places, spot);
  if (match) {
    if (match.ambiguousWith) {
      void tell(placesAlike(match.place.label, match.ambiguousWith.label));
      return;
    }
    placeId = match.place.id;
    placeRotation = match.rotationDeg;
    void tell(placeAlreadySaved(match.place.label));
    return;
  }
  if (places.length >= PLACES.maxPlaces) {
    void tell(placesFull(PLACES.maxPlaces));
    return;
  }
  const place: Place = {
    id: `place-${Date.now().toString(36)}`,
    label: placeLabel(places.length),
    readings: spot,
    marks: [],
  };
  places = [...places, place];
  savePlaces(places);
  placeId = place.id;
  placeRotation = 0;
  void tell(`${placeSaved(place.label)} ${markPrompt(currentInputStyle())}`);
}

const MARK_BY_ACTION: Record<'markWall' | 'markDoorway' | 'markStep' | 'markObstacle', MarkKind> = {
  markWall: 'wall',
  markDoorway: 'doorway',
  markStep: 'step',
  markObstacle: 'obstacle',
};

function openMark(): void {
  markReturnSub = sub === 'pinged' ? 'pinged' : 'revealed';
  sub = 'marking';
  changed();
  void tell(markPrompt(currentInputStyle()));
}

/** Stores what the learner says is there, at the facing and distance just measured. */
function chooseMark(kind: MarkKind): void {
  const place = places.find((p) => p.id === placeId);
  const heading = placeHeadingNow();
  const last = spotReadings().at(-1);
  sub = markReturnSub;
  changed();
  if (!place || heading === null || !last) {
    void tell(PLACE_NOT_SAVED);
    return;
  }
  const { place: updated, duplicate } = addMark(place, kind, heading, last.distanceM);
  if (duplicate) {
    void tell(markDuplicate(kind));
    return;
  }
  places = places.map((p) => (p.id === updated.id ? updated : p));
  savePlaces(places);
  void tell(markDone(kind, signedTurn(0, heading), last.distanceM));
}

/** What the saved place says about this spot, spoken only when the learner asks, so the reveal stays short. */
function placeReplayNotes(): string[] {
  const spot = toPlaceReadings(spotReadings());
  const match = matchPlaces(places, spot);
  if (match?.ambiguousWith) return [placesAlike(match.place.label, match.ambiguousWith.label)];
  const place = places.find((p) => p.id === placeId);
  const heading = placeHeadingNow();
  const last = spotReadings().at(-1);
  if (!place || heading === null || !last) return [];
  const notes: string[] = [];
  const marks = marksAt(place, heading, PLACES.marksSpoken);
  if (marks.length > 0) notes.push(marksHere(marks));
  const gone = contradicted(place, heading, last.distanceM);
  if (gone) notes.push(markContradiction(gone, last.distanceM));
  return notes;
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
  rangeRough = false;
  filteredWarned = false;
  places = getPlaces();
  placeId = null;
  placeRotation = 0;
  spotStart = 0;
  markReturnSub = 'revealed';
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
    rangeRough = takeWasRough();
    guess = RANGING.guessStartM;
    // The heading is read before the reveal is spoken, while the learner still stands the way they pinged.
    const heading = currentHeading();
    const turn = heading !== null && lastHeading !== null ? signedTurn(lastHeading, heading) : null;
    if (heading !== null) {
      readings.push({ headingDeg: heading, distanceM: found.distanceM });
      firstHeading = firstHeading ?? heading;
      lastHeading = heading;
    }
    // Places: two facings at this spot are enough to compare it with the saved ones.
    const spot = toPlaceReadings(spotReadings());
    const match = matchPlaces(places, spot);
    if (match && !match.ambiguousWith) {
      placeId = match.place.id;
      placeRotation = match.rotationDeg;
    }
    const style = currentInputStyle();
    const said = ['Got it.'];
    if (!filteredWarned && audioFiltered()) {
      filteredWarned = true;
      said.push(ROOM_FILTERED);
    }
    if (heading !== null && !headingExplained) {
      headingExplained = true;
      said.push(HEADING_FIRST_PING);
    }
    if (turn !== null) said.push(spokenTurn(turn));
    if (match && !match.ambiguousWith) said.push(placeMatched(match.place.label));
    said.push(guessPrompt(guess), guessHelp(style));
    sub = 'pinged';
    changed();
    await tell(said.join(' '));
  } catch (err) {
    console.error(err);
    if (here()) void tell('Something went wrong with that ping. Try again.', { isError: true });
  } finally {
    // A ping still running from an earlier visit must not clear the new visit's guard.
    if (mine === visit) busy = false;
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
  void tell(`${lastJudgement.now}${rangeRough ? ` ${ROOM_ROUGH}` : ''} ${revealHint(style)}`);
}

/** Releases everything the check holds: the microphone, the chirp, speech, and any ping still in flight. */
export function abortRoom(): void {
  visit++;
  speaking++;
  // A ping cut off by Back may never settle, so the guard is released here or the next visit would be deaf.
  busy = false;
  stopCompass();
  readings = [];
  firstHeading = null;
  lastHeading = null;
  headingExplained = false;
  rangeRough = false;
  filteredWarned = false;
  placeId = null;
  placeRotation = 0;
  spotStart = 0;
  markReturnSub = 'revealed';
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
      const parts = [lastJudgement.reveal];
      if (rangeRough) parts.push(ROOM_ROUGH);
      parts.push(...placeReplayNotes());
      if (direction) parts.push(direction);
      void tell(parts.join(' '));
      return true;
    }
    case 'next':
      if (sub !== 'revealed') return false;
      rangeRough = false;
      // A new spot: the saved place and its marks belong to the standing place left behind.
      placeId = null;
      placeRotation = 0;
      spotStart = readings.length;
      sub = 'idle';
      changed();
      void tell(tryAgainPrompt(currentInputStyle()));
      return true;
    case 'savePlace':
      if (sub !== 'pinged' && sub !== 'revealed') return false;
      keepPlace();
      return true;
    case 'mark':
      if (sub !== 'pinged' && sub !== 'revealed') return false;
      openMark();
      return true;
    case 'markWall':
    case 'markDoorway':
    case 'markStep':
    case 'markObstacle':
      if (sub !== 'marking') return false;
      chooseMark(MARK_BY_ACTION[action]);
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
  if (sub === 'marking') return ['markWall', 'markDoorway', 'markStep', 'markObstacle', ...tail];
  // Saving needs two facings of this spot, so the button appears only once that shape exists.
  const placeActions: Action[] = spotReadings().length >= 2 ? ['savePlace', 'mark'] : [];
  if (sub === 'pinged') return ['far', 'near', 'answer', ...placeActions, 'click', ...tail];
  if (sub === 'revealed') return ['replay', 'next', ...placeActions, 'click', ...tail];
  return ['click', ...tail];
}

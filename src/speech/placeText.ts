// What the real-room check says about places and the things marked in them (§13.6). Pure, so the wording is tested.
// A place is recognised by its echo signature, never by a position; a mark is only ever what the learner told Echo.
import { HEADING } from '../config';
import { signedTurn } from '../engine/roomDirection';
import type { MarkKind, PlaceMark } from '../engine/placeMap';
import { spokenNumber } from '../levels/feedback';
import type { InputStyle } from './inputText';
import { metres, turnWords } from './roomText';

const MARK_WORDS: Record<MarkKind, string> = {
  wall: 'a wall',
  doorway: 'a doorway or opening',
  step: 'a step or drop',
  obstacle: 'an obstacle',
};

/** A mark kind as a sentence fragment: "a doorway or opening". */
export function markWord(kind: MarkKind): string {
  return MARK_WORDS[kind];
}

const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** A facing as a mark hears it: one short clause, not the longer "of the way you first faced". */
function markFacing(turnDeg: number): string {
  const magnitude = Math.abs(turnDeg);
  if (magnitude < HEADING.sameDirectionDeg) return 'straight ahead';
  if (magnitude >= HEADING.turnAroundDeg) return 'behind you';
  return `${turnWords(magnitude)} to your ${turnDeg < 0 ? 'left' : 'right'}`;
}

/** The four things a learner can mark, in the order the keys and buttons offer them. */
export function markPrompt(style: InputStyle): string {
  if (style === 'keys') return 'What is here? Press 3 for a wall, 4 for a doorway, 5 for a step, or 6 for an obstacle.';
  return 'What is here? Choose Wall, Doorway or opening, Step or drop, or Obstacle.';
}

export function savePlacePrompt(style: InputStyle): string {
  return style === 'keys' ? 'Press P to save this place.' : 'Choose Save this place to keep it.';
}

export function placeSaved(label: string): string {
  return `Saved as ${label}. Turn and ping again to check that I know it.`;
}

export function placeMatched(label: string): string {
  return `This looks like ${label}.`;
}

export function placeAlreadySaved(label: string): string {
  return `This looks like ${label}, so I will not keep it twice.`;
}

/** Two saved places fit equally well, so neither is named: a guess here would be a lie. */
export function placesAlike(a: string, b: string): string {
  return `${a} and ${b} sound too alike here, so I will not guess which one this is. Mark something to tell them apart.`;
}

export function saveNeedsOneMorePing(): string {
  return 'Turn and ping once more, then save, so this place has a shape.';
}

export function placesFull(max: number): string {
  return `I can keep ${spokenNumber(max)} places. Press Reset progress in Settings to make room.`;
}

export const PLACE_NOT_SAVED = 'Save this place first, so I know where the mark belongs.';

export function markDone(kind: MarkKind, turnDeg: number, distanceM: number): string {
  return `${cap(markWord(kind))} marked, ${markFacing(turnDeg)}, ${metres(distanceM)}.`;
}

export function markDuplicate(kind: MarkKind): string {
  return `${cap(markWord(kind))} is already marked here, at about the same distance.`;
}

/** The marks facing this way, as one short sentence: "Here you marked a wall, straight ahead, two metres." */
export function marksHere(marks: readonly PlaceMark[]): string {
  const parts = marks.map(
    (m) => `${markWord(m.kind)}, ${markFacing(signedTurn(0, m.headingDeg))}, ${metres(m.distanceM)}`,
  );
  if (parts.length === 0) return '';
  if (parts.length === 1) return `Here you marked ${parts[0]}.`;
  return `Here you marked ${parts.slice(0, -1).join('; ')}; and ${parts.at(-1)}.`;
}

/** A mark whose measured distance no longer matches. Echo reports the measurement, never why it changed. */
export function markContradiction(mark: PlaceMark, measuredM: number): string {
  return `You marked ${markWord(mark.kind)} here at ${metres(mark.distanceM)}; it now measures ${metres(measuredM)}.`;
}


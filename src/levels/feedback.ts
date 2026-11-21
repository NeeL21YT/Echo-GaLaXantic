import { LEVEL, LEVEL_FEEDBACK, MULBERRY32 } from '../config';
import { bearingDeg, distPointToSegment, wrapDeg } from '../engine/geometry';
import type { Pose, Vec2, World } from '../types';
import type { AnswerResult } from './types';

export function trialSeed(rng: () => number, index: number): number {
  // The runner restarts the run RNG for each trial; index must contribute independent variation.
  return (Math.floor(rng() * MULBERRY32.uint32Range)
    ^ Math.imul(index + 1, LEVEL_FEEDBACK.trialSeedMix)) >>> 0;
}

export function withoutWith(without: World, withWorld: World): AnswerResult['contrast'] {
  return [{ label: 'Without', world: without }, { label: 'With', world: withWorld }];
}

export function emptyWorld(world: World): World {
  return { segments: [], poles: [], bounds: { ...world.bounds } };
}

export function sideExplanation(side: string | number, correct: boolean): string {
  return correct
    ? `Correct, ${side}. That slightly earlier, louder echo on one side is the cue.`
    : `Not quite. The wall was on your ${side}. The echo arrives a little earlier and louder in your ${side} ear.`;
}

export function spokenNumber(value: number): string {
  const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const radix = LEVEL_FEEDBACK.numberBase;
  if (Number.isInteger(value) && value >= 0) {
    if (value < small.length) return small[value]!;
    if (value < tens.length * radix) {
      const remainder = value % radix;
      return `${tens[Math.floor(value / radix)]}${remainder ? `-${small[remainder]}` : ''}`;
    }
    const hundred = radix * radix;
    if (value < hundred * radix) {
      const rest = value % hundred;
      return `${small[Math.floor(value / hundred)]} hundred${rest ? ` ${spokenNumber(rest)}` : ''}`;
    }
  }
  return String(value);
}

/** Whole numbers and halves as a voice says them: 1.5 is "one and a half", 0.5 is "half a". */
export function spokenDecimal(value: number): string {
  if (Number.isInteger(value)) return spokenNumber(value);
  const whole = Math.floor(value);
  if (value - whole === LEVEL_FEEDBACK.half) return whole === 0 ? 'half a' : `${spokenNumber(whole)} and a half`;
  return String(value);
}

/** A count with its unit, singular for one: "one second", "forty-seven seconds". */
export function spokenCount(value: number, unit: string): string {
  return `${spokenNumber(value)} ${unit}${value === 1 ? '' : 's'}`;
}

export function distanceExplanation(answer: string | number, correct: boolean): string {
  const cue = answer === 'near'
    ? `The wall was near, ${spokenNumber(LEVEL.l2.nearM)} metre${LEVEL.l2.nearM === 1 ? '' : 's'}. Near echoes come sooner and sound brighter.`
    : `The wall was far, ${spokenNumber(LEVEL.l2.farM)} metres. Far echoes come later and sound duller.`;
  return `${correct ? 'Correct.' : 'Not quite.'} ${cue}`;
}

export function doorExplanation(bearing: number, pose: Pose, correct: boolean): string {
  if (correct) return 'Correct. You were facing the door. The quiet direction is the gap.';
  const relative = wrapDeg(bearing - pose.headingDeg);
  const magnitude = Math.abs(relative);
  const rounded = Math.round(magnitude / LEVEL_FEEDBACK.degreeRoundStep) * LEVEL_FEEDBACK.degreeRoundStep;
  const direction = magnitude <= LEVEL.l3.toleranceDeg ? 'straight ahead'
    : magnitude > LEVEL_FEEDBACK.behindDeg ? 'behind you'
      : `${spokenNumber(rounded)} degrees to your ${relative < 0 ? 'left' : 'right'}`;
  return `Not quite. The door was ${direction}. Listen for the side where the room goes quiet.`;
}

function nearestWallPoint(world: World, pose: Pose): Vec2 {
  let nearest = Infinity;
  let point = pose.p;
  for (const segment of world.segments) {
    const distance = distPointToSegment(pose.p, segment.a, segment.b);
    if (distance >= nearest) continue;
    nearest = distance;
    const dx = segment.b.x - segment.a.x;
    const dy = segment.b.y - segment.a.y;
    const squaredLength = dx * dx + dy * dy;
    const t = squaredLength === 0 ? 0 : Math.max(0, Math.min(1,
      ((pose.p.x - segment.a.x) * dx + (pose.p.y - segment.a.y) * dy) / squaredLength));
    point = { x: segment.a.x + t * dx, y: segment.a.y + t * dy };
  }
  return point;
}

export function wallBumpExplanation(world: World, pose: Pose): string {
  const relative = wrapDeg(bearingDeg(pose.p, nearestWallPoint(world, pose)) - pose.headingDeg);
  const magnitude = Math.abs(relative);
  const direction = magnitude <= LEVEL_FEEDBACK.wallAheadDeg ? 'ahead'
    : magnitude >= LEVEL_FEEDBACK.fullTurnDeg / 2 - LEVEL_FEEDBACK.wallAheadDeg ? 'behind you'
      : `on your ${relative < 0 ? 'left' : 'right'}`;
  return `That was the wall ${direction}. A wall gives a strong, close echo.`;
}

export function poleBumpExplanation(world: World, pose: Pose): string {
  const wallDistance = Math.min(...world.segments.map(segment => distPointToSegment(pose.p, segment.a, segment.b)));
  const pole = world.poles.reduce<World['poles'][number] | undefined>((nearest, candidate) => {
    const distance = (center: Vec2, radius: number) => Math.hypot(pose.p.x - center.x, pose.p.y - center.y) - radius;
    return !nearest || distance(candidate.c, candidate.r) < distance(nearest.c, nearest.r) ? candidate : nearest;
  }, undefined);
  if (!pole || Math.hypot(pose.p.x - pole.c.x, pose.p.y - pole.c.y) - pole.r > wallDistance) {
    return wallBumpExplanation(world, pose);
  }
  const relative = wrapDeg(bearingDeg(pose.p, pole.c) - pose.headingDeg);
  const magnitude = Math.abs(relative);
  const ahead = magnitude <= LEVEL_FEEDBACK.fullTurnDeg / 4;
  const side = relative < 0 ? 'left' : 'right';
  const direction = magnitude === 0 ? 'just ahead'
    : magnitude === LEVEL_FEEDBACK.fullTurnDeg / 2 ? 'just behind you'
      : `just ${ahead ? 'ahead' : 'behind'}, ${magnitude < LEVEL_FEEDBACK.slightlyDeg ? 'slightly ' : 'to your '}${side}`;
  return `The pole was ${direction}. A pole gives a small, short echo, much weaker than a wall.`;
}

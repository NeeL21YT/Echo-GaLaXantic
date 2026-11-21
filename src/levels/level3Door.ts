import { LEVEL, LEVEL_FEEDBACK } from '../config';
import { bearingDeg, wrapDeg } from '../engine/geometry';
import { mulberry32, shuffle } from '../engine/rng';
import { room, type WallSide } from '../engine/worlds';
import { doorExplanation, trialSeed, withoutWith } from './feedback';
import type { LevelDef } from './types';

export const level3: LevelDef = {
  id: 3,
  title: 'Find the door',
  skill: 'Gaps are silent',
  intro: 'Listen for the quiet gap in the room.',
  mode: 'aim',
  trials: LEVEL.l3.trials,
  passRule: results => results.filter(result => result.correct).length >= LEVEL.l3.passCorrect,
  makeTrial: (rng, index) => {
    const walls: WallSide[] = ['N', 'E', 'S', 'W'];
    const plan = [...shuffle(walls, rng), walls[Math.floor(rng() * walls.length)]!];
    const wall = plan[index]!;
    const seed = trialSeed(rng, index);
    const random = mulberry32(seed);
    const halfRoom = LEVEL.l3.roomM / 2;
    const maxCenter = halfRoom - LEVEL.l3.cornerMarginM - LEVEL.l3.gapWidthM / 2;
    const center = (random() * 2 - 1) * maxCenter;
    const gap = { wall, center, width: LEVEL.l3.gapWidthM };
    const gapCenter = wall === 'N' ? { x: center, y: halfRoom }
      : wall === 'E' ? { x: halfRoom, y: center }
        : wall === 'S' ? { x: center, y: -halfRoom } : { x: -halfRoom, y: center };
    const start = { p: { x: 0, y: 0 },
      headingDeg: Math.floor(random() * LEVEL_FEEDBACK.fullTurnDeg / LEVEL.l3.headingStepDeg) * LEVEL.l3.headingStepDeg };
    return { seed, world: room(LEVEL.l3.roomM, LEVEL.l3.roomM, [gap]), start,
      answer: bearingDeg(start.p, gapCenter), meta: { gap } };
  },
  answerKeys: {},
  check: (trial, _answer, pose) => {
    const bearing = Number(trial.answer);
    // Angle wrapping can add one floating-point rounding unit at the inclusive boundary.
    const roundingDeg = Number.EPSILON * LEVEL_FEEDBACK.fullTurnDeg;
    const correct = Math.abs(wrapDeg(pose.headingDeg - bearing)) <= LEVEL.l3.toleranceDeg + roundingDeg;
    return { correct, explanation: doorExplanation(bearing, pose, correct),
      contrast: withoutWith(room(LEVEL.l3.roomM, LEVEL.l3.roomM), trial.world) };
  },
};

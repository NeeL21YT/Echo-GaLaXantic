import { LEVEL } from '../config';
import { mulberry32 } from '../engine/rng';
import { corridor } from '../engine/worlds';
import { poleBumpExplanation, spokenNumber, trialSeed, withoutWith } from './feedback';
import type { LevelDef } from './types';

export const level4: LevelDef = {
  id: 4,
  title: 'The pole',
  skill: 'Small objects',
  intro: 'Reach the end of the corridor. Listen for the small, short echo of a pole. Click with Space. Walk with W and S. Turn with A and D.',
  mode: 'navigate',
  trials: LEVEL.l4.trials,
  passRule: results => results.filter(result => result.correct).length >= LEVEL.l4.passRuns,
  makeTrial: (rng, index) => {
    const seed = trialSeed(rng, index);
    const random = mulberry32(seed);
    const x = LEVEL.l4.poleXM[0] + random() * (LEVEL.l4.poleXM[1] - LEVEL.l4.poleXM[0]);
    const y = LEVEL.l4.poleYM[0] + random() * (LEVEL.l4.poleYM[1] - LEVEL.l4.poleYM[0]);
    return { seed, world: corridor(LEVEL.l4.widthM, LEVEL.l4.lengthM, [{ x, y }]),
      start: { p: { x: 0, y: LEVEL.startInsetM }, headingDeg: 0 }, answer: 'exit' };
  },
  answerKeys: {},
  check: (trial, answer, pose) => {
    if (answer !== 'exit') return { correct: false, explanation: poleBumpExplanation(trial.world, pose) };
    const collisions = trial.meta?.collisions;
    const correct = collisions === 0;
    const count = typeof collisions === 'number' ? collisions : 0;
    return { correct,
      explanation: correct ? 'You reached the end with no bumps.'
        : `You reached the end with ${spokenNumber(count)} bump${count === 1 ? '' : 's'}. Listen for the small, short echo of the pole.`,
      contrast: withoutWith(corridor(LEVEL.l4.widthM, LEVEL.l4.lengthM), trial.world) };
  },
};

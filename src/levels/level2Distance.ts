import { LEVEL } from '../config';
import { shuffle } from '../engine/rng';
import { frontWall } from '../engine/worlds';
import { distanceExplanation, trialSeed } from './feedback';
import type { LevelDef } from './types';

export const level2: LevelDef = {
  id: 2,
  title: 'Near or far?',
  skill: 'Distance',
  intro: 'A wall is near or far ahead. Click with Space. Near echoes come sooner and sound brighter. Press one for near or two for far.',
  mode: 'choice',
  trials: LEVEL.l2.trials,
  passRule: results => results.filter(result => result.correct).length >= LEVEL.l2.passCorrect,
  makeTrial: (rng, index) => {
    const plan = shuffle(Array.from({ length: LEVEL.l2.trials }, (_, i) =>
      i < LEVEL.l2.trials / 2 ? 'near' : 'far'), rng);
    const answer = plan[index]!;
    return { seed: trialSeed(rng, index),
      world: frontWall(answer === 'near' ? LEVEL.l2.nearM : LEVEL.l2.farM),
      start: { p: { x: 0, y: 0 }, headingDeg: 0 }, answer };
  },
  answerKeys: { '1': 'near', '2': 'far' },
  check: (trial, answer) => {
    const correct = answer === trial.answer;
    return { correct, explanation: distanceExplanation(trial.answer, correct),
      contrast: [{ label: 'Near', world: frontWall(LEVEL.l2.nearM) }, { label: 'Far', world: frontWall(LEVEL.l2.farM) }] };
  },
};

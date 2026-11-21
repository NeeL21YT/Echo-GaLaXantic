import { LEVEL } from '../config';
import { shuffle } from '../engine/rng';
import { singleWall } from '../engine/worlds';
import { emptyWorld, sideExplanation, trialSeed, withoutWith } from './feedback';
import type { LevelDef } from './types';

export const level1: LevelDef = {
  id: 1,
  title: 'Which side?',
  skill: 'Direction',
  intro: 'A wall is on your left or your right. Listen for which side.',
  mode: 'choice',
  trials: LEVEL.l1.trials,
  passRule: results => results.filter(result => result.correct).length >= LEVEL.l1.passCorrect,
  makeTrial: (rng, index) => {
    const plan = shuffle(Array.from({ length: LEVEL.l1.trials }, (_, i) =>
      i < LEVEL.l1.trials / 2 ? 'left' as const : 'right' as const), rng);
    const answer = plan[index]!;
    return {
      seed: trialSeed(rng, index),
      world: singleWall(answer, LEVEL.l1.wallDistM),
      start: { p: { x: 0, y: 0 }, headingDeg: 0 },
      answer,
    };
  },
  answerKeys: { ArrowLeft: 'left', ArrowRight: 'right' },
  check: (trial, answer) => {
    const correct = answer === trial.answer;
    return { correct, explanation: sideExplanation(trial.answer, correct),
      contrast: withoutWith(emptyWorld(trial.world), trial.world) };
  },
};

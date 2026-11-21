import { LEVEL } from '../config';
import { lCorridor } from '../engine/worlds';
import { spokenNumber, trialSeed, wallBumpExplanation } from './feedback';
import type { LevelDef } from './types';

export const level5: LevelDef = {
  id: 5,
  title: 'Escape',
  skill: 'Combined',
  intro: `Find the exit in under ${spokenNumber(LEVEL.l5.timeLimitS)} seconds. Listen for the side where the echo opens up.`,
  mode: 'navigate',
  trials: LEVEL.l5.trials,
  passRule: results => results[0]?.correct ?? false,
  makeTrial: (rng, index) => ({ seed: trialSeed(rng, index), world: lCorridor(),
    start: { p: { x: 0, y: LEVEL.startInsetM }, headingDeg: 0 }, answer: 'exit' }),
  answerKeys: {},
  check: (trial, answer, pose, elapsedS) => {
    if (answer !== 'exit') return { correct: false,
      explanation: `${wallBumpExplanation(trial.world, pose)} Turn toward the side where the echo opens up.` };
    const correct = elapsedS < LEVEL.l5.timeLimitS;
    const limit = spokenNumber(LEVEL.l5.timeLimitS);
    // Speak completed seconds so a sub-limit finish never sounds like it took the full limit.
    return { correct, explanation: `You escaped in ${Math.floor(elapsedS)} seconds.`
      + (correct ? ` That is under ${limit} seconds. Passed.` : ` Try to get out in under ${limit} seconds.`) };
  },
};

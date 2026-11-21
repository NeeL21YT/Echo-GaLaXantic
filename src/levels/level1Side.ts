import type { LevelDef } from './types';

export const level1: LevelDef = {
  id: 1,
  title: '',
  skill: '',
  intro: '',
  mode: 'choice',
  trials: 0,
  passRule: () => {
    throw new Error('not implemented: level1.passRule');
  },
  makeTrial: () => {
    throw new Error('not implemented: level1.makeTrial');
  },
  answerKeys: {},
  check: () => {
    throw new Error('not implemented: level1.check');
  },
};

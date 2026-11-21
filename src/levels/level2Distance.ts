import type { LevelDef } from './types';

export const level2: LevelDef = {
  id: 2,
  title: '',
  skill: '',
  intro: '',
  mode: 'choice',
  trials: 0,
  passRule: () => {
    throw new Error('not implemented: level2.passRule');
  },
  makeTrial: () => {
    throw new Error('not implemented: level2.makeTrial');
  },
  answerKeys: {},
  check: () => {
    throw new Error('not implemented: level2.check');
  },
};

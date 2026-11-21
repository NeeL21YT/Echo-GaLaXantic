import type { LevelDef } from './types';

export const level4: LevelDef = {
  id: 4,
  title: '',
  skill: '',
  intro: '',
  mode: 'choice',
  trials: 0,
  passRule: () => {
    throw new Error('not implemented: level4.passRule');
  },
  makeTrial: () => {
    throw new Error('not implemented: level4.makeTrial');
  },
  answerKeys: {},
  check: () => {
    throw new Error('not implemented: level4.check');
  },
};

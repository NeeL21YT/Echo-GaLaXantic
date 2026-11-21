import type { LevelDef } from './types';

export const level3: LevelDef = {
  id: 3,
  title: '',
  skill: '',
  intro: '',
  mode: 'choice',
  trials: 0,
  passRule: () => {
    throw new Error('not implemented: level3.passRule');
  },
  makeTrial: () => {
    throw new Error('not implemented: level3.makeTrial');
  },
  answerKeys: {},
  check: () => {
    throw new Error('not implemented: level3.check');
  },
};

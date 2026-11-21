import type { LevelDef } from './types';

export const level5: LevelDef = {
  id: 5,
  title: '',
  skill: '',
  intro: '',
  mode: 'choice',
  trials: 0,
  passRule: () => {
    throw new Error('not implemented: level5.passRule');
  },
  makeTrial: () => {
    throw new Error('not implemented: level5.makeTrial');
  },
  answerKeys: {},
  check: () => {
    throw new Error('not implemented: level5.check');
  },
};

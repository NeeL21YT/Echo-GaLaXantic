import type { Pose } from '../types';
import type { AnswerResult, Trial } from './types';

export function explain(_levelId: number, _trial: Trial, _correct: boolean, _pose: Pose): AnswerResult {
  throw new Error('not implemented: explain');
}

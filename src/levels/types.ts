// Level contract (build_spec §7.1).
import type { Pose, World } from '../types';

export type LevelMode = 'choice' | 'aim' | 'navigate';

export interface Trial {
  seed: number;
  world: World;
  start: Pose;
  answer: string | number;
  meta?: Record<string, unknown>;
}

export interface AnswerResult {
  correct: boolean;
  explanation: string;
  contrast?: { label: string; world: World }[];
}

export interface LevelDef {
  id: 1 | 2 | 3 | 4 | 5;
  title: string;
  skill: string;
  intro: string; // spoken
  mode: LevelMode;
  trials: number; // number of trials per run
  passRule: (results: AnswerResult[], elapsedS: number) => boolean;
  makeTrial: (rng: () => number, index: number) => Trial; // must balance answers across a run
  answerKeys: Record<string, string>; // key → answer value
  check: (trial: Trial, answer: string | number | null, pose: Pose, elapsedS: number) => AnswerResult;
}

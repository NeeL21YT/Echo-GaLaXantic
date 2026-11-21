// Level contract (build_spec §7.1).
//
// How the runner drives a level (so levels stay pure and testable):
// - makeTrial(rng, index): the runner passes a FRESH mulberry32(runSeed) for every index of one run, so the
//   first draws are identical across a run. Use them to build the balanced answer plan (shuffle), pick
//   plan[index], then derive per-trial randomness from a sub-seed that mixes in `index`. Trial.seed is that sub-seed.
// - answerKeys maps a key (KeyboardEvent.key: 'ArrowLeft', 'ArrowRight', '1', '2', 'Enter') to the answer value
//   passed to check(). Buttons are shown for exactly these keys.
// - 'aim' levels (L3): the answer is null; check() judges the player's current pose.heading.
// - 'navigate' levels (L4/L5): the runner calls check(trialWithMeta, 'bump', pose, elapsedS) after a collision
//   (for the spoken explanation; not scored) and check(trialWithMeta, 'exit', pose, elapsedS) when the exit is
//   reached (scored). trialWithMeta.meta.collisions holds the collision count for the run.
// - contrast: list the stimuli to play in order, e.g. [{label:'Without', world: noWall}, {label:'With', world: trial.world}].
//   All are rendered from the pose the player answered from.
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

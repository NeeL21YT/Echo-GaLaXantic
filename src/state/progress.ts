// Trial log, run results and settings in localStorage (§8.3). No backend: everything stays on this device.
import { PASSES_TO_SUGGEST_LOWER, STRETCH_STEPS } from '../config';
import type { ClickSource, LevelId, Settings } from './store';

const TRIALS_KEY = 'echo.trials.v1';
const RUNS_KEY = 'echo.runs.v1';
const SETTINGS_KEY = 'echo.settings.v1';
const ONBOARDED_KEY = 'echo.onboarded.v1';

export type TrialLogEntry = {
  ts: number;
  runId: string;
  levelId: LevelId;
  trialIndex: number;
  seed: number;
  stretch: number;
  clickSource: ClickSource;
  renderVersion: number;
  answer: string | number | null;
  correct: boolean;
  replays: number;
  contrasts: number;
  collisions: number;
  elapsedS: number;
};

/** One finished run, so scores and pass streaks don't have to be rebuilt from individual trials. */
export type RunLogEntry = {
  ts: number;
  runId: string;
  levelId: LevelId;
  stretch: number;
  score: number;
  total: number;
  passed: boolean;
};

export type LevelStats = {
  lastScore: { score: number; total: number } | null;
  prevScore: { score: number; total: number } | null;
  bestScore: { score: number; total: number } | null;
  passesInRowAtStretch: number;
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode): progress is a nice-to-have, never a blocker.
  }
}

export function logTrial(entry: TrialLogEntry): void {
  write(TRIALS_KEY, [...getTrials(), entry]);
}

export function getTrials(): TrialLogEntry[] {
  return read<TrialLogEntry[]>(TRIALS_KEY, []);
}

export function logRun(entry: RunLogEntry): void {
  write(RUNS_KEY, [...getRuns(), entry]);
}

export function getRuns(): RunLogEntry[] {
  return read<RunLogEntry[]>(RUNS_KEY, []);
}

export function levelStats(levelId: LevelId, stretch: number): LevelStats {
  const runs = getRuns().filter((r) => r.levelId === levelId);
  const toScore = (r: RunLogEntry | undefined) => (r ? { score: r.score, total: r.total } : null);
  let best: RunLogEntry | undefined;
  for (const r of runs) if (!best || r.score / r.total > best.score / best.total) best = r;
  let streak = 0;
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    if (!r || !r.passed || r.stretch !== stretch) break;
    streak++;
  }
  return {
    lastScore: toScore(runs[runs.length - 1]),
    prevScore: toScore(runs[runs.length - 2]),
    bestScore: toScore(best),
    passesInRowAtStretch: streak,
  };
}

/** The next lower stretch step to suggest, or null if the streak isn't long enough or we're at real speed. */
export function suggestedStretch(levelId: LevelId, stretch: number): number | null {
  if (levelStats(levelId, stretch).passesInRowAtStretch < PASSES_TO_SUGGEST_LOWER) return null;
  const steps: readonly number[] = STRETCH_STEPS;
  const i = steps.indexOf(stretch);
  const next = i >= 0 ? steps[i + 1] : undefined;
  return next ?? null;
}

export function loadSettings(): Partial<Settings> {
  return read<Partial<Settings>>(SETTINGS_KEY, {});
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, settings);
}

export function isOnboarded(): boolean {
  return read<boolean>(ONBOARDED_KEY, false);
}

export function setOnboarded(done: boolean): void {
  write(ONBOARDED_KEY, done);
}

const LESSONS_KEY = 'echo.lessons.v1';

export function getLessonsDone(): number[] {
  return read<number[]>(LESSONS_KEY, []);
}

export function markLessonDone(id: number): void {
  const done = getLessonsDone();
  if (!done.includes(id)) write(LESSONS_KEY, [...done, id]);
}

export function resetProgress(): void {
  try {
    localStorage.removeItem(TRIALS_KEY);
    localStorage.removeItem(RUNS_KEY);
    localStorage.removeItem(LESSONS_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

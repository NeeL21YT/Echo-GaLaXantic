// Trial log, run results and settings in localStorage (§8.3). No backend: everything stays on this device.
// Every read validates its data: a missing key, corrupt JSON, an older build's shape or a hand-edited value falls back
// to a default instead of crashing, and every write is bounded and survives a full or blocked store.
import { DEFAULT_STRETCH, PASSES_TO_SUGGEST_LOWER, PLACES, STORAGE_LIMITS, STRETCH_STEPS } from '../config';
import { isMarkKind, type Place, type PlaceMark, type PlaceReading } from '../engine/placeMap';
import type { ClickSource, LevelId, Settings } from './store';

export const TRIALS_KEY = 'echo.trials.v1';
export const RUNS_KEY = 'echo.runs.v1';
export const SETTINGS_KEY = 'echo.settings.v1';
export const ONBOARDED_KEY = 'echo.onboarded.v1';
export const LESSONS_KEY = 'echo.lessons.v1';
export const PLACES_KEY = 'echo.places.v1';

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

// ---------- storage access ----------

function store(): Storage | null {
  try {
    // Merely touching localStorage can throw when site data is blocked.
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const raw = store()?.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Storage full or blocked (private mode): progress is a nice-to-have, never a blocker.
    return false;
  }
}

function removeKey(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

/** Writes the newest `max` items; when the store is full, keeps halving the log until it fits. */
function writeBounded<T>(key: string, items: T[], max: number): void {
  let keep = items.slice(-max);
  while (keep.length > 0) {
    if (writeJson(key, keep)) return;
    keep = keep.slice(Math.ceil(keep.length / 2));
  }
  removeKey(key);
}

// ---------- validation helpers ----------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isId = (v: unknown): v is LevelId => isNum(v) && Number.isInteger(v) && v >= 1;
const num = (v: unknown, fallback: number): number => (isNum(v) ? v : fallback);

function toTrial(v: unknown): TrialLogEntry | null {
  if (!isRecord(v) || !isNum(v.ts) || !isId(v.levelId) || typeof v.correct !== 'boolean') return null;
  const answer = typeof v.answer === 'string' || isNum(v.answer) ? v.answer : null;
  return {
    ts: v.ts,
    runId: typeof v.runId === 'string' ? v.runId : '',
    levelId: v.levelId,
    trialIndex: num(v.trialIndex, 0),
    seed: num(v.seed, 0),
    stretch: num(v.stretch, DEFAULT_STRETCH),
    clickSource: v.clickSource === 'mic' ? 'mic' : 'key',
    renderVersion: num(v.renderVersion, 0),
    answer,
    correct: v.correct,
    replays: num(v.replays, 0),
    contrasts: num(v.contrasts, 0),
    collisions: num(v.collisions, 0),
    elapsedS: num(v.elapsedS, 0),
  };
}

function toRun(v: unknown): RunLogEntry | null {
  if (!isRecord(v) || !isId(v.levelId) || !isNum(v.score) || !isNum(v.total) || typeof v.passed !== 'boolean') return null;
  // A zero total would make every comparison NaN, and a score above the total can't have happened.
  if (v.total <= 0 || v.score < 0 || v.score > v.total) return null;
  return {
    ts: num(v.ts, 0),
    runId: typeof v.runId === 'string' ? v.runId : '',
    levelId: v.levelId,
    stretch: num(v.stretch, DEFAULT_STRETCH),
    score: v.score,
    total: v.total,
    passed: v.passed,
  };
}

function readList<T>(key: string, convert: (v: unknown) => T | null, max: number): T[] {
  const raw = readJson(key);
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const ok = convert(item);
    if (ok) out.push(ok);
  }
  return out.slice(-max);
}

// ---------- trials and runs ----------

export function getTrials(): TrialLogEntry[] {
  return readList(TRIALS_KEY, toTrial, STORAGE_LIMITS.maxTrials);
}

export function logTrial(entry: TrialLogEntry): void {
  writeBounded(TRIALS_KEY, [...getTrials(), entry], STORAGE_LIMITS.maxTrials);
}

export function getRuns(): RunLogEntry[] {
  return readList(RUNS_KEY, toRun, STORAGE_LIMITS.maxRuns);
}

export function logRun(entry: RunLogEntry): void {
  writeBounded(RUNS_KEY, [...getRuns(), entry], STORAGE_LIMITS.maxRuns);
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

// ---------- settings ----------

// Older builds, or a hand edit, may have written other spellings; only values we can map are kept.
function toNarration(v: unknown): Settings['narration'] | undefined {
  if (typeof v !== 'string') return undefined;
  const flat = v.toLowerCase().replace(/[^a-z]/g, '');
  if (flat === 'voice') return 'voice';
  if (flat === 'screenreader') return 'screenreader';
  return undefined;
}

/** Keeps only the fields that hold a valid value, so the store's defaults fill every gap. */
export function sanitizeSettings(raw: unknown): Partial<Settings> {
  if (!isRecord(raw)) return {};
  const out: Partial<Settings> = {};
  const steps: readonly number[] = STRETCH_STEPS;
  const stretch = typeof raw.stretch === 'string' ? Number(raw.stretch) : raw.stretch;
  if (isNum(stretch) && steps.includes(stretch)) out.stretch = stretch;
  const narration = toNarration(raw.narration);
  if (narration) out.narration = narration;
  if (raw.clickSource === 'key' || raw.clickSource === 'mic') out.clickSource = raw.clickSource;
  if (isNum(raw.volume)) out.volume = Math.min(1, Math.max(0, raw.volume));
  if (typeof raw.observer === 'boolean') out.observer = raw.observer;
  if (raw.morse === 'off' || raw.morse === 'vibration' || raw.morse === 'sound') out.morse = raw.morse;
  if (typeof raw.volumeKeys === 'boolean') out.volumeKeys = raw.volumeKeys;
  if (typeof raw.haptics === 'boolean') out.haptics = raw.haptics;
  return out;
}

export function loadSettings(): Partial<Settings> {
  return sanitizeSettings(readJson(SETTINGS_KEY));
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}

// ---------- onboarding and lessons ----------

export function isOnboarded(): boolean {
  return readJson(ONBOARDED_KEY) === true;
}

export function setOnboarded(done: boolean): void {
  if (done) writeJson(ONBOARDED_KEY, true);
  else removeKey(ONBOARDED_KEY);
}

export function getLessonsDone(): number[] {
  const raw = readJson(LESSONS_KEY);
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((v): v is number => isNum(v) && Number.isInteger(v) && v >= 0);
  return [...new Set(ids)].slice(-STORAGE_LIMITS.maxLessons);
}

export function markLessonDone(id: number): void {
  const done = getLessonsDone();
  if (!done.includes(id)) writeBounded(LESSONS_KEY, [...done, id], STORAGE_LIMITS.maxLessons);
}

/** Deletes scores, runs, finished lessons and saved places. Settings and the setup flag are kept; Redo setup
 *  handles the flag. */
export function resetProgress(): void {
  removeKey(TRIALS_KEY);
  removeKey(RUNS_KEY);
  removeKey(LESSONS_KEY);
  removeKey(PLACES_KEY);
}

// ---------- places ----------

const isHeading = (v: unknown): v is number => isNum(v);

function toPlaceReading(v: unknown): PlaceReading | null {
  if (!isRecord(v) || !isHeading(v.headingDeg) || !isNum(v.distanceM) || v.distanceM <= 0) return null;
  return { headingDeg: ((v.headingDeg % 360) + 360) % 360, distanceM: v.distanceM };
}

function toMark(v: unknown): PlaceMark | null {
  if (!isRecord(v) || !isMarkKind(v.kind) || !isHeading(v.headingDeg) || !isNum(v.distanceM) || v.distanceM <= 0) {
    return null;
  }
  return { kind: v.kind, headingDeg: ((v.headingDeg % 360) + 360) % 360, distanceM: v.distanceM };
}

/** A saved place from storage, or null when it cannot be used. A place with no readings has no shape and is dropped. */
function toPlace(v: unknown): Place | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.label !== 'string' || v.id === '') return null;
  const readings = Array.isArray(v.readings)
    ? v.readings.map(toPlaceReading).filter((r): r is PlaceReading => r !== null).slice(0, PLACES.maxReadingsPerPlace)
    : [];
  if (readings.length === 0) return null;
  const marks = Array.isArray(v.marks)
    ? v.marks.map(toMark).filter((m): m is PlaceMark => m !== null).slice(-PLACES.maxMarksPerPlace)
    : [];
  return { id: v.id.slice(0, 40), label: v.label.slice(0, 40), readings, marks };
}

export function getPlaces(): Place[] {
  return readList(PLACES_KEY, toPlace, PLACES.maxPlaces);
}

export function savePlaces(places: readonly Place[]): void {
  writeBounded(PLACES_KEY, places.slice(-PLACES.maxPlaces), PLACES.maxPlaces);
}

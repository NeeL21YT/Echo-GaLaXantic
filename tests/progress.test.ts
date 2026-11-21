import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STRETCH, STORAGE_LIMITS } from '../src/config';
import {
  LESSONS_KEY,
  ONBOARDED_KEY,
  RUNS_KEY,
  SETTINGS_KEY,
  TRIALS_KEY,
  getLessonsDone,
  getRuns,
  getTrials,
  isOnboarded,
  levelStats,
  loadSettings,
  logRun,
  logTrial,
  markLessonDone,
  resetProgress,
  sanitizeSettings,
  saveSettings,
  setOnboarded,
  suggestedStretch,
  type RunLogEntry,
  type TrialLogEntry,
} from '../src/state/progress';
import type { Settings } from '../src/state/store';

const DEFAULT_SETTINGS: Settings = {
  stretch: DEFAULT_STRETCH,
  narration: 'voice',
  clickSource: 'key',
  volume: 1,
  observer: false,
  morse: 'off',
  volumeKeys: true,
  haptics: false,
};

class FakeStorage {
  data = new Map<string, string>();
  /** Max characters of one value; larger writes throw like a full store. */
  quota = Infinity;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (v.length > this.quota) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

let fake: FakeStorage;
beforeEach(() => {
  fake = new FakeStorage();
  vi.stubGlobal('localStorage', fake);
});
afterEach(() => vi.unstubAllGlobals());

const run = (over: Partial<RunLogEntry> = {}): RunLogEntry => ({
  ts: 1,
  runId: 'r',
  levelId: 1,
  stretch: 4,
  score: 8,
  total: 10,
  passed: true,
  ...over,
});
const trial = (over: Partial<TrialLogEntry> = {}): TrialLogEntry => ({
  ts: 1,
  runId: 'r',
  levelId: 1,
  trialIndex: 0,
  seed: 1,
  stretch: 4,
  clickSource: 'key',
  renderVersion: 3,
  answer: 'left',
  correct: true,
  replays: 0,
  contrasts: 0,
  collisions: 0,
  elapsedS: 1,
  ...over,
});

describe('settings load and save', () => {
  it('returns nothing for a missing key', () => {
    expect(loadSettings()).toEqual({});
  });

  it('round-trips a full settings object', () => {
    const s = { ...DEFAULT_SETTINGS, stretch: 2, volume: 0.5, morse: 'sound' as const, haptics: true };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it('survives corrupt JSON and non-object values', () => {
    for (const bad of ['{nope', '"text"', '42', 'null', '[1,2]']) {
      fake.setItem(SETTINGS_KEY, bad);
      expect(loadSettings()).toEqual({});
    }
  });

  it('keeps old-shape data and leaves new fields missing so defaults fill them', () => {
    fake.setItem(SETTINGS_KEY, JSON.stringify({ stretch: 3, narration: 'screenreader', clickSource: 'key', volume: 0.7, observer: true }));
    expect(loadSettings()).toEqual({ stretch: 3, narration: 'screenreader', clickSource: 'key', volume: 0.7, observer: true });
  });

  it('drops wrong types and out-of-range values field by field', () => {
    const out = sanitizeSettings({
      stretch: 5,
      narration: 3,
      clickSource: 'usb',
      volume: 'loud',
      observer: 'yes',
      morse: 'flash',
      volumeKeys: 1,
      haptics: null,
    });
    expect(out).toEqual({});
  });

  it('clamps volume and accepts a numeric-string stretch', () => {
    expect(sanitizeSettings({ volume: 7 }).volume).toBe(1);
    expect(sanitizeSettings({ volume: -2 }).volume).toBe(0);
    expect(sanitizeSettings({ stretch: '2' }).stretch).toBe(2);
    expect(sanitizeSettings({ volume: NaN })).toEqual({});
  });

  it('maps older spellings of the narration value', () => {
    expect(sanitizeSettings({ narration: 'screen-reader' }).narration).toBe('screenreader');
    expect(sanitizeSettings({ narration: 'Voice' }).narration).toBe('voice');
  });
});

describe('onboarding flag', () => {
  it('is false when missing, corrupt or the wrong type', () => {
    expect(isOnboarded()).toBe(false);
    for (const bad of ['{x', '"true"', '1', 'null']) {
      fake.setItem(ONBOARDED_KEY, bad);
      expect(isOnboarded()).toBe(false);
    }
  });

  it('is set and cleared', () => {
    setOnboarded(true);
    expect(isOnboarded()).toBe(true);
    setOnboarded(false);
    expect(isOnboarded()).toBe(false);
    expect(fake.getItem(ONBOARDED_KEY)).toBeNull();
  });
});

describe('runs and trials', () => {
  it('start empty and append in order', () => {
    expect(getRuns()).toEqual([]);
    logRun(run({ score: 1 }));
    logRun(run({ score: 2 }));
    expect(getRuns().map((r) => r.score)).toEqual([1, 2]);
    logTrial(trial());
    expect(getTrials()).toHaveLength(1);
  });

  it('skip malformed entries and non-array stores', () => {
    fake.setItem(RUNS_KEY, JSON.stringify([run(), { levelId: 1 }, null, 'x', run({ total: 0 }), run({ score: 11 }), run({ passed: undefined })]));
    expect(getRuns()).toHaveLength(1);
    fake.setItem(RUNS_KEY, '{"a":1}');
    expect(getRuns()).toEqual([]);
    fake.setItem(TRIALS_KEY, 'garbage');
    expect(getTrials()).toEqual([]);
    logTrial(trial());
    expect(getTrials()).toHaveLength(1);
  });

  it('fills fields an older build did not write', () => {
    fake.setItem(TRIALS_KEY, JSON.stringify([{ ts: 5, levelId: 2, correct: false }]));
    expect(getTrials()[0]).toMatchObject({ ts: 5, levelId: 2, correct: false, runId: '', clickSource: 'key', stretch: DEFAULT_STRETCH });
  });

  it('keep only the newest entries', () => {
    for (let i = 0; i < STORAGE_LIMITS.maxRuns + 5; i++) logRun(run({ ts: i }));
    const runs = getRuns();
    expect(runs).toHaveLength(STORAGE_LIMITS.maxRuns);
    expect(runs[runs.length - 1]?.ts).toBe(STORAGE_LIMITS.maxRuns + 4);
    for (let i = 0; i < STORAGE_LIMITS.maxTrials + 5; i++) logTrial(trial({ ts: i }));
    expect(getTrials()).toHaveLength(STORAGE_LIMITS.maxTrials);
  });

  it('shed old entries when the store is full, and never throw', () => {
    for (let i = 0; i < 20; i++) logRun(run({ ts: i }));
    fake.quota = 600;
    expect(() => logRun(run({ ts: 99 }))).not.toThrow();
    const runs = getRuns();
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.length).toBeLessThan(21);
    expect(runs[runs.length - 1]?.ts).toBe(99);
  });

  it('never throw when storage is missing or throws on access', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => {
      logRun(run());
      logTrial(trial());
      saveSettings(DEFAULT_SETTINGS);
      setOnboarded(true);
      markLessonDone(1);
      resetProgress();
    }).not.toThrow();
    expect(getRuns()).toEqual([]);
    expect(loadSettings()).toEqual({});
    expect(isOnboarded()).toBe(false);

    const blocked = {};
    for (const m of ['getItem', 'setItem', 'removeItem']) {
      Object.defineProperty(blocked, m, {
        value: () => {
          throw new Error('blocked');
        },
      });
    }
    vi.stubGlobal('localStorage', blocked);
    expect(() => logRun(run())).not.toThrow();
    expect(getRuns()).toEqual([]);
  });
});

describe('levelStats', () => {
  it('reports none for a level without runs', () => {
    expect(levelStats(3, 4)).toEqual({ lastScore: null, prevScore: null, bestScore: null, passesInRowAtStretch: 0 });
  });

  it('reports last, previous and best by level', () => {
    logRun(run({ score: 9 }));
    logRun(run({ score: 5, passed: false }));
    logRun(run({ levelId: 2, score: 1 }));
    logRun(run({ score: 7 }));
    const st = levelStats(1, 4);
    expect(st.lastScore).toEqual({ score: 7, total: 10 });
    expect(st.prevScore).toEqual({ score: 5, total: 10 });
    expect(st.bestScore).toEqual({ score: 9, total: 10 });
  });

  it('counts the pass streak at one stretch and breaks on a miss or another stretch', () => {
    logRun(run());
    logRun(run());
    expect(levelStats(1, 4).passesInRowAtStretch).toBe(2);
    expect(levelStats(1, 3).passesInRowAtStretch).toBe(0);
    logRun(run({ passed: false }));
    expect(levelStats(1, 4).passesInRowAtStretch).toBe(0);
    logRun(run({ stretch: 3 }));
    logRun(run());
    expect(levelStats(1, 4).passesInRowAtStretch).toBe(1);
  });
});

describe('suggestedStretch', () => {
  it('needs three passes in a row', () => {
    logRun(run());
    logRun(run());
    expect(suggestedStretch(1, 4)).toBeNull();
    logRun(run());
    expect(suggestedStretch(1, 4)).toBe(3);
  });

  it('never suggests below real speed or from an unknown step', () => {
    for (let i = 0; i < 3; i++) logRun(run({ stretch: 1 }));
    expect(suggestedStretch(1, 1)).toBeNull();
    for (let i = 0; i < 3; i++) logRun(run({ stretch: 5 }));
    expect(suggestedStretch(1, 5)).toBeNull();
  });
});

describe('lessons', () => {
  it('mark once and ignore junk', () => {
    markLessonDone(2);
    markLessonDone(2);
    markLessonDone(1);
    expect(getLessonsDone()).toEqual([2, 1]);
    fake.setItem(LESSONS_KEY, JSON.stringify([1, 'a', 1, 2.5, -1, null, 3]));
    expect(getLessonsDone()).toEqual([1, 3]);
    fake.setItem(LESSONS_KEY, '{');
    expect(getLessonsDone()).toEqual([]);
  });
});

describe('resetProgress', () => {
  it('deletes scores, runs and lessons but keeps settings and the setup flag', () => {
    logRun(run());
    logTrial(trial());
    markLessonDone(1);
    saveSettings({ ...DEFAULT_SETTINGS, volume: 0.4 });
    setOnboarded(true);
    resetProgress();
    expect(getRuns()).toEqual([]);
    expect(getTrials()).toEqual([]);
    expect(getLessonsDone()).toEqual([]);
    expect(levelStats(1, 4).lastScore).toBeNull();
    expect(loadSettings().volume).toBe(0.4);
    expect(isOnboarded()).toBe(true);
  });
});

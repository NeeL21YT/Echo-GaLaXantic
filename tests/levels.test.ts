import { describe, expect, it, vi } from 'vitest';
import { LEVEL, MULBERRY32, POLE_RADIUS_M } from '../src/config';
import { bearingDeg, wrapDeg } from '../src/engine/geometry';
import { move } from '../src/engine/collision';
import * as random from '../src/engine/rng';
import { corridor, frontWall, lCorridor, room, singleWall, type Gap, type WallSide } from '../src/engine/worlds';
import { LEVELS } from '../src/levels';
import { doorExplanation, spokenCount } from '../src/levels/feedback';
import { level1 } from '../src/levels/level1Side';
import { level2 } from '../src/levels/level2Distance';
import { level3 } from '../src/levels/level3Door';
import { level4 } from '../src/levels/level4Pole';
import { level5 } from '../src/levels/level5Escape';
import type { AnswerResult, LevelDef, Trial } from '../src/levels/types';

// Mirror the runner: each index receives a fresh RNG with the same run seed.
function run(level: LevelDef, seed: number): Trial[] {
  return Array.from({ length: level.trials }, (_, index) => level.makeTrial(random.mulberry32(seed), index));
}

function gapOf(trial: Trial): Gap {
  const half = LEVEL.l3.roomM / 2;
  for (const wall of ['N', 'E', 'S', 'W'] as const) {
    const horizontal = wall === 'N' || wall === 'S';
    const fixed = wall === 'N' || wall === 'E' ? half : -half;
    const pieces = trial.world.segments.filter(segment => horizontal
      ? segment.a.y === fixed && segment.b.y === fixed
      : segment.a.x === fixed && segment.b.x === fixed);
    if (pieces.length !== 2) continue;
    const from = horizontal ? pieces[0]!.b.x : pieces[0]!.b.y;
    const to = horizontal ? pieces[1]!.a.x : pieces[1]!.a.y;
    return { wall, center: (from + to) / 2, width: to - from };
  }
  throw new Error('Expected one gap represented by two wall segments');
}

function gapPoint(gap: Gap) {
  const half = LEVEL.l3.roomM / 2;
  switch (gap.wall) {
    case 'N': return { x: gap.center, y: half };
    case 'E': return { x: half, y: gap.center };
    case 'S': return { x: gap.center, y: -half };
    case 'W': return { x: -half, y: gap.center };
  }
}

function score(correct: number, total: number): AnswerResult[] {
  return Array.from({ length: total }, (_, index) => ({ correct: index < correct, explanation: 'Test result.' }));
}

describe('runner contract', () => {
  it('provides the exact key maps, modes, counts and spoken intros', () => {
    expect(LEVELS.map(level => level.mode)).toEqual(['choice', 'choice', 'aim', 'navigate', 'navigate']);
    expect(level1.answerKeys).toEqual({ ArrowLeft: 'left', ArrowRight: 'right' });
    expect(level2.answerKeys).toEqual({ '1': 'near', '2': 'far' });
    for (const level of [level3, level4, level5]) expect(level.answerKeys).toEqual({});
    expect(LEVELS.map(level => level.trials)).toEqual([10, 10, 5, 3, 1]);
    for (const level of LEVELS) {
      expect(level.title.trim()).not.toBe('');
      expect(level.skill.trim()).not.toBe('');
      // Controls are added at run time in the words of the device (keys, touch or buttons), so intros stay key-free.
      expect(level.intro.trim()).not.toBe('');
      expect(level.intro).not.toMatch(/\bSpace\b|\bEnter\b|\barrow\b/);
    }
  });
  it.each(LEVELS)('level $id is deterministic and assigns unsigned, index-specific seeds', level => {
    const first = run(level, 12345);
    expect(run(level, 12345)).toEqual(first);
    expect(new Set(first.map(trial => trial.seed)).size).toBe(level.trials);
    for (const trial of first) {
      expect(Number.isInteger(trial.seed)).toBe(true);
      expect(trial.seed).toBeGreaterThanOrEqual(0);
      expect(trial.seed).toBeLessThan(MULBERRY32.uint32Range);
    }
    expect(run(level, 54321).map(trial => trial.seed)).not.toEqual(first.map(trial => trial.seed));
  });
});

describe.each([{ level: level1, answers: ['left', 'right'] }, { level: level2, answers: ['near', 'far'] }])(
  'choice level $level.id', ({ level, answers }) => {
    it('balances answers five/five for every tested seed and varies order between seeds', () => {
      const orders = new Set<string>();
      for (let seed = 0; seed < 50; seed++) {
        const trials = run(level, seed);
        for (const answer of answers) expect(trials.filter(trial => trial.answer === answer)).toHaveLength(5);
        orders.add(trials.map(trial => trial.answer).join(','));
      }
      expect(orders.size).toBeGreaterThan(1);
    });
    it('scores answer values, names the actual cue and builds the expected contrast', () => {
      for (const trial of run(level, 42)) {
        expect(trial.start).toEqual({ p: { x: 0, y: 0 }, headingDeg: 0 });
        for (const answer of answers) {
          const result = level.check(trial, answer, trial.start, 0);
          expect(result.correct).toBe(answer === trial.answer);
          expect(result.explanation).toContain(result.correct ? 'Correct' : 'Not quite.');
          expect(result.explanation).toContain(String(trial.answer));
          expect(result.explanation).toContain('echo');
          if (level === level1) {
            expect(trial.world).toEqual(singleWall(trial.answer as 'left' | 'right', LEVEL.l1.wallDistM));
            expect(result.explanation).toBe(result.correct
              ? `Correct, ${trial.answer}. That slightly earlier, louder echo on one side is the cue.`
              : `Not quite. The wall was on your ${trial.answer}. The echo arrives a little earlier and louder in your ${trial.answer} ear.`);
            expect(result.contrast).toEqual([
              { label: 'Without', world: { segments: [], poles: [], bounds: trial.world.bounds } },
              { label: 'With', world: trial.world },
            ]);
          } else {
            expect(trial.world).toEqual(frontWall(trial.answer === 'near' ? LEVEL.l2.nearM : LEVEL.l2.farM));
            expect(result.explanation).toBe(`${result.correct ? 'Correct.' : 'Not quite.'} ` + (trial.answer === 'near'
              ? 'The wall was near, one metre. Near echoes come sooner and sound brighter.'
              : 'The wall was far, three metres. Far echoes come later and sound duller.'));
            expect(result.contrast).toEqual([
              { label: 'Near', world: frontWall(LEVEL.l2.nearM) }, { label: 'Far', world: frontWall(LEVEL.l2.farM) },
            ]);
          }
        }
      }
    });
  },
);

describe('level three', () => {
  it('visits every wall once before adding the fifth random wall', () => {
    for (let seed = 0; seed < 50; seed++) {
      const trials = run(level3, seed);
      expect(trials.slice(0, 4).map(trial => gapOf(trial).wall).sort()).toEqual(['E', 'N', 'S', 'W']);
      expect(['N', 'E', 'S', 'W']).toContain(gapOf(trials[4]!).wall);
    }
  });
  it('stores exact canonical bearings for centred gaps on all four walls', () => {
    const freshRunRng = random.mulberry32;
    // Fix per-trial draws at the midpoint; keep the balanced plan's RNG real.
    const stub = vi.spyOn(random, 'mulberry32').mockReturnValue(() => 0.5);
    try {
      const expected: Record<WallSide, number> = { N: 0, E: 90, S: 180, W: -90 };
      for (let index = 0; index < 4; index++) {
        const trial = level3.makeTrial(freshRunRng(42), index);
        const gap = gapOf(trial);
        expect(gap.center).toBe(0);
        expect(trial.answer).toBe(expected[gap.wall]);
      }
    } finally {
      stub.mockRestore();
    }
  });
  it('keeps gap edges safe, computes bearings and quantises headings across 200 random trials', () => {
    const centers = new Set<number>();
    const headings = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const trial = level3.makeTrial(random.mulberry32(seed), seed % LEVEL.l3.trials);
      const gap = gapOf(trial);
      expect(gap.width).toBeCloseTo(LEVEL.l3.gapWidthM);
      expect(LEVEL.l3.roomM / 2 - Math.abs(gap.center) - gap.width / 2).toBeGreaterThanOrEqual(0.75);
      expect(trial.answer).toBeCloseTo(bearingDeg(trial.start.p, gapPoint(gap)));
      expect(trial.start.p).toEqual({ x: 0, y: 0 });
      expect(trial.start.headingDeg % 15).toBe(0);
      expect(trial.start.headingDeg).toBeGreaterThanOrEqual(0);
      expect(trial.start.headingDeg).toBeLessThan(360);
      centers.add(gap.center);
      headings.add(trial.start.headingDeg);
    }
    expect(centers.size).toBeGreaterThan(100);
    expect(headings.size).toBe(24);
  });
  it.each([-25, -20, 0, 20, 25])('judges final heading offset %s, including wrapped headings', offset => {
    for (let seed = 0; seed < 200; seed++) {
      const trial = level3.makeTrial(random.mulberry32(seed), seed % LEVEL.l3.trials);
      const pose = { ...trial.start, headingDeg: wrapDeg(Number(trial.answer) + offset) };
      expect(level3.check(trial, null, pose, 0).correct).toBe(Math.abs(offset) <= 20);
    }
  });
  it('accepts the twenty-degree boundary when wrapping adds floating-point round-off', () => {
    const trial = { ...run(level3, 42)[0]!, answer: 132.07319999999999 };
    expect(level3.check(trial, null, { ...trial.start, headingDeg: 152.07320000000004 }, 0).correct).toBe(true);
    expect(level3.check(trial, null, { ...trial.start, headingDeg: Number(trial.answer) + 20.001 }, 0).correct).toBe(false);
  });
  it('describes direction from the final heading and rounds to the nearest five degrees', () => {
    const trial = { ...run(level3, 42)[0]!, answer: 0 };
    expect(level3.check(trial, null, { ...trial.start, headingDeg: -42 }, 0).explanation)
      .toBe('Not quite. The door was forty degrees to your right. Listen for the side where the room goes quiet.');
    expect(level3.check(trial, null, { ...trial.start, headingDeg: 43 }, 0).explanation).toContain('forty-five degrees to your left');
    expect(level3.check(trial, null, { ...trial.start, headingDeg: 151 }, 0).explanation).toContain('behind you');
    expect(doorExplanation(0, { ...trial.start, headingDeg: 20 }, false)).toContain('straight ahead');
    const correct = level3.check(trial, null, { ...trial.start, headingDeg: 0 }, 0);
    expect(correct.explanation).toBe('Correct. You were facing the door. The quiet direction is the gap.');
    expect(correct.contrast).toEqual([
      { label: 'Without', world: room(LEVEL.l3.roomM, LEVEL.l3.roomM) }, { label: 'With', world: trial.world },
    ]);
  });
});

describe('level four', () => {
  it('places one pole inside the ranges and varies its position across seeds and indices', () => {
    const positions = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      for (const trial of run(level4, seed)) {
        expect(trial.world.poles).toHaveLength(1);
        const pole = trial.world.poles[0]!;
        expect(pole.c.x).toBeGreaterThanOrEqual(LEVEL.l4.poleXM[0]);
        expect(pole.c.x).toBeLessThanOrEqual(LEVEL.l4.poleXM[1]);
        expect(pole.c.y).toBeGreaterThanOrEqual(LEVEL.l4.poleYM[0]);
        expect(pole.c.y).toBeLessThanOrEqual(LEVEL.l4.poleYM[1]);
        expect(pole.r).toBe(POLE_RADIUS_M);
        expect(trial.start).toEqual({ p: { x: 0, y: LEVEL.startInsetM }, headingDeg: 0 });
        expect(trial.world).toEqual(corridor(LEVEL.l4.widthM, LEVEL.l4.lengthM, [pole.c]));
        positions.add(JSON.stringify(pole.c));
      }
    }
    expect(positions.size).toBe(300);
  });
  it.each([0, 1, 2, 10, 11])('scores exit with %s collisions and speaks the count', collisions => {
    const trial = { ...run(level4, 42)[0]!, meta: { collisions } };
    const result = level4.check(trial, 'exit', trial.start, 0);
    expect(result.correct).toBe(collisions === 0);
    const counts: Record<number, string> = { 0: 'no bumps', 1: 'one bump', 2: 'two bumps', 10: 'ten bumps', 11: 'eleven bumps' };
    expect(result.explanation).toContain(counts[collisions]);
    expect(result.contrast).toEqual([
      { label: 'Without', world: corridor(LEVEL.l4.widthM, LEVEL.l4.lengthM) }, { label: 'With', world: trial.world },
    ]);
  });
  it.each([[0, 'just ahead, slightly left'], [180, 'just behind, to your right'], [90, 'just behind, to your left']])(
    'describes pole direction at heading %s', (headingDeg, direction) => {
      const trial = { ...run(level4, 42)[0]!, world: corridor(2, 10, [{ x: 0, y: 5 }]) };
      const result = level4.check(trial, 'bump', { p: { x: 0.1, y: 4.5 }, headingDeg }, 0);
      expect(result.correct).toBe(false);
      expect(result.explanation).toBe(`The pole was ${direction}. A pole gives a small, short echo, much weaker than a wall.`);
      expect(result.explanation).not.toContain('Bump.');
      expect(result.contrast).toBeUndefined();
    },
  );
  it('explains an actual pole collision from the unchanged pose returned by the engine', () => {
    const trial = run(level4, 42)[0]!;
    const pole = trial.world.poles[0]!;
    const pose = { p: { x: pole.c.x, y: pole.c.y - 0.5 }, headingDeg: 0 };
    const step = move(pose, 0.5, trial.world);
    expect(step.collided).toBe(true);
    expect(step.pose).toEqual(pose);
    expect(level4.check({ ...trial, meta: { collisions: 1 } }, 'bump', step.pose, 1).explanation)
      .toBe('The pole was just ahead. A pole gives a small, short echo, much weaker than a wall.');
  });
  it.each([[0, 'on your right'], [90, 'ahead'], [180, 'on your left'], [270, 'behind you']])(
    'describes the nearest wall at heading %s', (headingDeg, direction) => {
      const trial = run(level4, 42)[0]!;
      const result = level4.check(trial, 'bump', { p: { x: 0.75, y: 2 }, headingDeg }, 0);
      expect(result.explanation).toBe(`That was the wall ${direction}. A wall gives a strong, close echo.`);
      expect(result.correct).toBe(false);
    },
  );
});

describe('level five', () => {
  it('uses the L corridor and inset start', () => {
    const trial = run(level5, 42)[0]!;
    expect(trial.world).toEqual(lCorridor());
    expect(trial.start).toEqual({ p: { x: 0, y: LEVEL.startInsetM }, headingDeg: 0 });
  });
  it.each([54, 54.9, 89, 89.9, 90, 91])('scores exit at %s seconds independently of collisions', elapsed => {
    const trial = { ...run(level5, 42)[0]!, meta: { collisions: 100 } };
    const result = level5.check(trial, 'exit', trial.start, elapsed);
    expect(result.correct).toBe(elapsed < 90);
    expect(result.explanation).toBe(`You escaped in ${spokenCount(Math.floor(elapsed), 'second')}.`
      + (elapsed < 90 ? ' That is under ninety seconds. Passed. You followed the side where the echo opens up.' : ' Try to get out in under ninety seconds.'));
    expect(result.contrast).toBeUndefined();
  });
  it('keeps bump feedback unscored and names the wall and open echo cue', () => {
    const trial = run(level5, 42)[0]!;
    expect(level5.check(trial, 'bump', { p: { x: -0.75, y: 3 }, headingDeg: 0 }, 1)).toEqual({ correct: false,
      explanation: 'That was the wall on your left. A wall gives a strong, close echo. Turn toward the side where the echo opens up.' });
  });
});

describe('pass rules', () => {
  it.each([level1, level2])('level $id passes eight out of ten, but not seven', level => {
    expect(level.passRule(score(8, 10), 0)).toBe(true);
    expect(level.passRule(score(7, 10), 0)).toBe(false);
  });
  it('level three passes four out of five, but not three', () => {
    expect(level3.passRule(score(4, 5), 0)).toBe(true);
    expect(level3.passRule(score(3, 5), 0)).toBe(false);
  });
  it('level four passes two out of three, but not one', () => {
    expect(level4.passRule(score(2, 3), 0)).toBe(true);
    expect(level4.passRule(score(1, 3), 0)).toBe(false);
  });
  it('level five uses only the scored exit result', () => {
    expect(level5.passRule(score(1, 1), 1000)).toBe(true);
    expect(level5.passRule(score(0, 1), 1)).toBe(false);
    expect(level5.passRule([], 0)).toBe(false);
  });
});

describe('feedback completeness', () => {
  it.each(LEVELS)('level $id explains every outcome without changing the trial', level => {
    for (const trial of run(level, 42)) {
      const original = structuredClone(trial);
      const pose = { ...trial.start, headingDeg: Number(trial.answer) || 0 };
      const results = level.mode === 'choice'
        ? Object.values(level.answerKeys).map(answer => level.check(trial, answer, pose, 0))
        : level.mode === 'aim'
          ? [level.check(trial, null, pose, 0), level.check(trial, null, { ...pose, headingDeg: pose.headingDeg + 180 }, 0)]
          : [level.check(trial, 'bump', pose, 0),
            level.check({ ...trial, meta: { collisions: 0 } }, 'exit', pose, 89),
            level.check({ ...trial, meta: { collisions: 1 } }, 'exit', pose, 91)];
      expect(results.some(result => result.correct)).toBe(true);
      expect(results.some(result => !result.correct)).toBe(true);
      for (const result of results) {
        expect(result.explanation.trim().length).toBeGreaterThan(10);
        expect(result.explanation.toLowerCase()).not.toBe('wrong');
        expect(result.explanation).not.toMatch(/undefined|NaN|not implemented/);
      }
      expect(trial).toEqual(original);
    }
  });
});

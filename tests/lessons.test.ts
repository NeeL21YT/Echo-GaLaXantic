import { describe, expect, it } from 'vitest';
import { buildEchoes } from '../src/engine/echoBuilder';
import { castRays } from '../src/engine/raycaster';
import { LESSONS, type LessonStep } from '../src/levels/lessons';

const demos = (id: number) =>
  LESSONS.find((l) => l.id === id)!.pages.flat().filter((s): s is Extract<LessonStep, { kind: 'demo' }> => s.kind === 'demo');
const voicesOf = (d: Extract<LessonStep, { kind: 'demo' }>) => buildEchoes(castRays(d.world, d.pose), 4);

describe('lessons', () => {
  it('have unique ids and at least one page of spoken text', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) expect(l.pages.some((p) => p.some((s) => s.kind === 'say'))).toBe(true);
  });

  it('keep every spoken line short enough to follow by ear', () => {
    for (const l of LESSONS)
      for (const step of l.pages.flat())
        if (step.kind === 'say') expect(step.text.split(/\s+/).length).toBeLessThanOrEqual(45);
  });

  it('never use failure language', () => {
    const text = LESSONS.flatMap((l) => l.pages.flat()).map((s) => (s.kind === 'say' ? s.text : '')).join(' ').toLowerCase();
    expect(text).not.toMatch(/\bwrong\b|\bfail/);
  });

  it('wall-side demo A and B differ in direction', () => {
    const [left, right] = demos(2).map(voicesOf);
    expect(left!.length).toBeGreaterThan(0);
    expect(Math.sign(left![0]!.azDeg)).toBe(-Math.sign(right![0]!.azDeg));
  });

  it('near demo is louder and earlier than far demo', () => {
    const [near, far] = demos(3).map(voicesOf);
    expect(near![0]!.gain).toBeGreaterThan(far![0]!.gain);
    expect(near![0]!.delayS).toBeLessThan(far![0]!.delayS);
  });

  it('doorway demo has less echo energy ahead than the solid wall', () => {
    const [solid, door] = demos(4).map(voicesOf);
    const ahead = (v: ReturnType<typeof voicesOf>) =>
      v.filter((x) => Math.abs(x.azDeg) < 30).reduce((s, x) => s + x.gain, 0);
    expect(ahead(door!)).toBeLessThan(ahead(solid!));
  });

  it('pole demo adds a close echo straight ahead that the empty corridor lacks', () => {
    const [empty, pole] = demos(5).map(voicesOf);
    const ahead = (v: ReturnType<typeof voicesOf>) =>
      v.filter((x) => Math.abs(x.azDeg) < 10 && x.d < 3).reduce((s, x) => s + x.gain, 0);
    expect(ahead(pole!)).toBeGreaterThan(ahead(empty!));
  });
});

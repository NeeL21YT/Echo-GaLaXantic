import { describe, expect, it } from 'vitest';
import { READABLE_SELECTOR } from '../src/input/readAloud';
import { spokenCount, spokenDecimal, spokenNumber } from '../src/levels/feedback';
import { PHRASES } from '../src/speech/inputText';
import { getLevelTitleLine, progressLine, stretchLabel } from '../src/ui/labels';

describe('spoken numbers', () => {
  it('hyphenates tens, reads hundreds, and handles halves', () => {
    expect(spokenNumber(47)).toBe('forty-seven');
    expect(spokenNumber(105)).toBe('one hundred five');
    expect(spokenDecimal(1.5)).toBe('one and a half');
    expect(spokenDecimal(0.5)).toBe('half a');
    expect(spokenDecimal(4)).toBe('four');
    expect(spokenCount(1, 'second')).toBe('one second');
    expect(spokenCount(2, 'bump')).toBe('two bumps');
  });
  it('writes the status chips in words', () => {
    expect(getLevelTitleLine(1, 1, 10)).toBe('Level one · Trial two of ten');
    expect(stretchLabel(4)).toBe('four times slower');
    expect(stretchLabel(1.5)).toBe('one and a half times slower');
    expect(stretchLabel(1)).toBe('real speed');
  });
});

describe('progress line', () => {
  it('leaves out empty fields and returns null with no scores', () => {
    expect(progressLine(2, { lastScore: null, prevScore: null, bestScore: null })).toBeNull();
    expect(progressLine(2, { lastScore: { score: 8, total: 10 }, prevScore: null, bestScore: { score: 9, total: 10 } }))
      .toBe('Level two: last eight out of ten, best nine out of ten.');
  });
});

describe('touch surface', () => {
  it('does not read the message aloud, so a long press there is an action', () => {
    expect(READABLE_SELECTOR).not.toContain('blind-message');
    expect(READABLE_SELECTOR).toContain('button');
  });
  it('gives every style a next step and a level list from anywhere', () => {
    for (const p of Object.values(PHRASES)) {
      expect(p.nextHint.length).toBeGreaterThan(0);
      expect(p.levelListAnywhere).toMatch(/level list/i);
    }
    expect(PHRASES.touch.levelListInstead).toMatch(/three fingers/);
  });
});

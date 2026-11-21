import { describe, expect, it } from 'vitest';
import { PHRASES, resolveInputStyle } from '../src/speech/inputText';

describe('resolveInputStyle', () => {
  it('uses buttons with a screen reader, whatever the device', () => {
    expect(resolveInputStyle({ screenReaderOn: true, coarsePointer: true })).toBe('buttons');
    expect(resolveInputStyle({ screenReaderOn: true, coarsePointer: false })).toBe('buttons');
  });
  it('uses touch on a phone and keys on a desktop', () => {
    expect(resolveInputStyle({ screenReaderOn: false, coarsePointer: true })).toBe('touch');
    expect(resolveInputStyle({ screenReaderOn: false, coarsePointer: false })).toBe('keys');
  });
});

describe('phrases', () => {
  it('never mention keys to touch or button users', () => {
    for (const style of ['touch', 'buttons'] as const) {
      const p = PHRASES[style];
      const all = [p.click, p.answerSide, p.answerDistance, p.turn, p.walk, p.faceDoor, p.begin, p.levelList, p.yes, p.clickFirst, p.feedbackHint(true), p.help, p.tone('left'), p.areaLabel, p.levelPrompt ?? ''].join(' ');
      expect(all).not.toMatch(/\bSpace\b|\bEnter\b|\barrow\b|\bEscape\b|\b[A-Z] (clicks|replays)\b|Press [A-Z]\b/);
    }
  });
  it('has the same shape for every style', () => {
    expect(Object.keys(PHRASES.touch).sort()).toEqual(Object.keys(PHRASES.keys).sort());
    expect(Object.keys(PHRASES.buttons).sort()).toEqual(Object.keys(PHRASES.keys).sort());
  });
  it('mentions contrast only when there is one', () => {
    expect(PHRASES.touch.feedbackHint(false)).not.toMatch(/contrast/);
    expect(PHRASES.touch.feedbackHint(true)).toMatch(/contrast/);
  });
});

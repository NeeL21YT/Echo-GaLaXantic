import { describe, expect, it } from 'vitest';
import { morseTimings, toMorse, totalMs } from '../src/speech/morse';

describe('toMorse', () => {
  it('encodes the fixed feedback words', () => {
    expect(toMorse('OK')).toBe('--- -.-');
    expect(toMorse('TRY')).toBe('- .-. -.--');
    expect(toMorse('B')).toBe('-...');
  });
  it('encodes digits and separates words', () => {
    expect(toMorse('3')).toBe('...--');
    expect(toMorse('a b')).toBe('.- / -...');
  });
  it('skips characters it cannot encode', () => {
    expect(toMorse('A!B')).toBe('.- -...');
    expect(toMorse('!!!')).toBe('');
  });
});

describe('morseTimings', () => {
  it('alternates on and off starting with on', () => {
    // E T → dot, 3-unit letter gap, dash
    expect(morseTimings('ET', 10)).toEqual([10, 30, 30]);
  });
  it('uses 1-unit gaps inside a letter and 7-unit gaps between words', () => {
    expect(morseTimings('I', 10)).toEqual([10, 10, 10]);
    expect(morseTimings('E E', 10)).toEqual([10, 70, 10]);
  });
  it('has an odd length (ends on a tone) and no leading gap', () => {
    const t = morseTimings('OK', 10);
    expect(t.length % 2).toBe(1);
    expect(t[0]).toBe(30);
  });
  it('is empty for nothing encodable', () => {
    expect(morseTimings('?!')).toEqual([]);
  });
  it('totals the pattern', () => {
    expect(totalMs([10, 30, 30])).toBe(70);
  });
});

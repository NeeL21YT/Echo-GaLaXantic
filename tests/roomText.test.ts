import { describe, expect, it } from 'vitest';
import { RANGING } from '../src/config';
import { guessPrompt, judgeGuess } from '../src/speech/roomText';

describe('judgeGuess', () => {
  it('says close within the tolerance and always reveals at first', () => {
    const j = judgeGuess(1.5, 1.8, 0);
    expect(j.close).toBe(true);
    expect(j.now).toContain('1.8 metres');
    expect(j.now).toContain('Close.');
  });

  it('says off outside the tolerance', () => {
    const j = judgeGuess(1, 2.2, 0);
    expect(j.close).toBe(false);
    expect(j.now).toContain('Off by more than');
  });

  it('holds the number back after enough close guesses in a row', () => {
    const j = judgeGuess(2, 2.1, RANGING.passesToFade);
    expect(j.now).not.toContain('2.1');
    expect(j.now).toContain('Tell me the distance');
    expect(j.reveal).toContain('2.1 metres');
  });

  it('says one metre in the singular', () => {
    expect(guessPrompt(1)).toBe('Your guess is 1 metre.');
    expect(guessPrompt(1.5)).toBe('Your guess is 1.5 metres.');
  });
});

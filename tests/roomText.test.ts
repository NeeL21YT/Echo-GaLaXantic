import { describe, expect, it } from 'vitest';
import { RANGING } from '../src/config';
import { guessPrompt, judgeGuess } from '../src/speech/roomText';

describe('judgeGuess', () => {
  it('says close within the tolerance and always reveals at first', () => {
    const j = judgeGuess(1.5, 1.8, 0);
    expect(j.close).toBe(true);
    expect(j.now).toContain('one point eight metres');
    expect(j.now).toContain('Close.');
  });

  it('says off outside the tolerance', () => {
    const j = judgeGuess(1, 2.2, 0);
    expect(j.close).toBe(false);
    expect(j.now).toContain('Off by more than');
  });

  it('holds the number back after enough close guesses in a row', () => {
    const j = judgeGuess(2, 2.1, RANGING.passesToFade);
    expect(j.now).not.toContain('two point one');
    expect(j.now).toContain('Tell me the distance');
    expect(j.reveal).toContain('two point one metres');
  });

  it('says one metre in the singular', () => {
    expect(guessPrompt(1)).toBe('Your guess is one metre.');
    expect(guessPrompt(1.5)).toBe('Your guess is one and a half metres.');
  });
});

describe('reveal difference', () => {
  it('says how far off the guess was', () => {
    expect(judgeGuess(2, 1.5, 0).reveal).toContain('You were half a metre too far.');
    expect(judgeGuess(1, 2, 0).reveal).toContain('You were one metre too near.');
    expect(judgeGuess(2, 2, 0).reveal).toContain('spot on');
  });
});

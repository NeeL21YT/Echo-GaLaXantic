import { describe, expect, it } from 'vitest';
import { RANGING } from '../src/config';
import {
  facingWords, guessPrompt, judgeGuess, nearestDirectionNote, spokenTurn,
} from '../src/speech/roomText';

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

describe('spokenTurn', () => {
  it('says a small net turn as the same way', () => {
    expect(spokenTurn(5)).toBe('You are facing the same way as your last measurement.');
    expect(spokenTurn(-10)).toBe('You are facing the same way as your last measurement.');
  });

  it('names the side and rounds the size', () => {
    expect(spokenTurn(88)).toBe('You turned about ninety degrees to your right since your last measurement.');
    expect(spokenTurn(-47)).toBe('You turned about forty-five degrees to your left since your last measurement.');
  });

  it('says a full turn as turning around', () => {
    expect(spokenTurn(180)).toBe('You turned around since your last measurement.');
  });
});

describe('facingWords', () => {
  it('describes the facing relative to the first one', () => {
    expect(facingWords(0)).toBe('the way you first faced');
    expect(facingWords(92)).toBe('about ninety degrees to your right of the way you first faced');
    expect(facingWords(-180)).toBe('the opposite of the way you first faced');
  });
});

describe('nearestDirectionNote', () => {
  it('says nothing until a second direction has been measured', () => {
    expect(nearestDirectionNote([], null)).toBeNull();
    expect(nearestDirectionNote([{ headingDeg: 0, distanceM: 2 }], 0)).toBeNull();
  });

  it('names the nearest reading by the way the phone faced, and says what it does not know', () => {
    const ahead = nearestDirectionNote(
      [{ headingDeg: 0, distanceM: 1.5 }, { headingDeg: 90, distanceM: 2.4 }],
      0,
    );
    expect(ahead).toContain('Nearest reading so far: one and a half metres');
    expect(ahead).toContain('taken while you faced the way you first faced');
    expect(ahead).toContain('whichever side of you it was on');

    const turned = nearestDirectionNote(
      [{ headingDeg: 0, distanceM: 2.4 }, { headingDeg: 90, distanceM: 1.5 }],
      0,
    );
    expect(turned).toContain('taken while you faced about ninety degrees to your right of the way you first faced');
  });
});

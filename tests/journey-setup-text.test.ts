import { describe, expect, it } from 'vitest';
import { lessonHelp, pageHint } from '../src/speech/lessonText';
import { guessHelp, judgeGuess, metres, revealHint, roomIntro } from '../src/speech/roomText';
import { micQuestion, micTestPrompt, narrationQuestion, setupLabels } from '../src/speech/setupText';

const KEYS = /\bSpace\b|\bEnter\b|\bEscape\b|Press [A-Z]\b|\barrow\b/;

describe('setup, lesson and room wording', () => {
  it('never mentions keys to touch or button users', () => {
    for (const style of ['touch', 'buttons'] as const) {
      const all = [
        narrationQuestion(style), micQuestion(style), micTestPrompt(style, 'three'), ...Object.values(setupLabels(style)),
        pageHint(style, { page: 4, pages: 4, practiceLevel: 3, hasNextLesson: true }),
        pageHint(style, { page: 1, pages: 4, practiceLevel: null, hasNextLesson: true }),
        lessonHelp(style), ...roomIntro(style), guessHelp(style), revealHint(style), judgeGuess(2, 2.1, 3, style).now,
      ].join(' ');
      expect(all).not.toMatch(KEYS);
    }
  });

  it('says distances as words and keeps the safety line', () => {
    expect(metres(0.5)).toBe('half a metre');
    expect(metres(1)).toBe('one metre');
    expect(metres(1.5)).toBe('one and a half metres');
    expect(metres(2.3)).toBe('two point three metres');
    expect(roomIntro('keys').join(' ')).toContain('not a navigation aid');
  });

  it('splits the room introduction into short messages', () => {
    for (const m of roomIntro('touch')) expect(m.split(/\s+/).length).toBeLessThanOrEqual(30);
  });
});

import { describe, expect, it } from 'vitest';
import { COACH_MIC_OFF, pageHint } from '../src/speech/lessonText';
import { MIC_TEST_QUIET } from '../src/speech/setupText';

describe('mic-off wording', () => {
  it('lesson 1 says the mic is off, to practise alone, and how to allow it', () => {
    expect(COACH_MIC_OFF).toMatch(/microphone is off/i);
    expect(COACH_MIC_OFF).toMatch(/Practise ten slow clicks/);
    expect(COACH_MIC_OFF).toMatch(/Open settings/);
  });

  it('a quiet mic test says the microphone was switched off', () => {
    expect(MIC_TEST_QUIET).toMatch(/switched the microphone off/);
  });
});

describe('lesson 6 practice target', () => {
  it('names the real room check instead of a level in every input style', () => {
    for (const style of ['keys', 'touch', 'buttons'] as const) {
      const text = pageHint(style, { page: 3, pages: 3, practiceLevel: 'room', hasNextLesson: false });
      expect(text).toMatch(/open the real room check/);
      expect(text).not.toMatch(/Level/);
    }
  });
});

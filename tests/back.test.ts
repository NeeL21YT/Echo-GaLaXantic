import { describe, expect, it } from 'vitest';
import { backStep } from '../src/input/back';
import type { Phase } from '../src/state/store';

describe('backStep', () => {
  it('closes settings first, wherever they were opened', () => {
    for (const p of ['levelSelect', 'ready', 'lesson'] as Phase[]) expect(backStep(p, true)).toBe('closeSettings');
  });
  it('goes up to the level list from every practice screen', () => {
    for (const p of ['lesson', 'realRoom', 'intro', 'ready', 'answered', 'feedback', 'summary'] as Phase[]) {
      expect(backStep(p, false)).toBe('levelList');
    }
  });
  it('asks before closing from the top screens', () => {
    expect(backStep('levelSelect', false)).toBe('confirmExit');
    expect(backStep('onboarding', false)).toBe('confirmExit');
  });
});

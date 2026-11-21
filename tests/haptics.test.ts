import { describe, expect, it } from 'vitest';
import { HAPTIC } from '../src/config';
import { hapticKindForAction, hapticPattern, type HapticKind } from '../src/speech/hapticPatterns';

const KINDS: HapticKind[] = ['left', 'right', 'near', 'far', 'pass', 'miss', 'bump'];
const total = (p: readonly number[]) => p.reduce((a, b) => a + b, 0);

describe('haptic patterns', () => {
  it('are all different from one another', () => {
    const seen = new Set(KINDS.map((k) => hapticPattern(k).join(',')));
    expect(seen.size).toBe(KINDS.length);
  });

  it('end on a buzz (odd length) and stay short', () => {
    for (const k of KINDS) {
      const p = hapticPattern(k);
      expect(p.length % 2).toBe(1);
      expect(total(p)).toBeLessThanOrEqual(HAPTIC.maxTotalMs);
    }
  });

  it('tell near and far apart by length, and left and right by count', () => {
    expect(Math.max(...hapticPattern('far'))).toBeGreaterThan(Math.max(...hapticPattern('near')) * 4);
    expect(hapticPattern('right').length).toBeGreaterThan(hapticPattern('left').length);
  });

  it('maps only answer actions', () => {
    expect(hapticKindForAction('left')).toBe('left');
    expect(hapticKindForAction('far')).toBe('far');
    expect(hapticKindForAction('click')).toBeNull();
    expect(hapticKindForAction('answer')).toBeNull();
  });
});

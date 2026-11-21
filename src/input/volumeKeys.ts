// Volume buttons as controls (§13.3). Pure mapping; the native plugin delivers the key events.
import type { Action } from '../state/store';

/** Up is "do the main thing" (click, continue, begin); down is "again" (replay, then next). */
export function actionForVolumeKey(key: 'up' | 'down', valid: readonly Action[], phase: string): Action | null {
  // Replay works in the ready phase too, but the buttons only list it after an answer.
  const usable = phase === 'ready' ? [...valid, 'replay' as const] : valid;
  // Guessing a distance in the real room: up is farther, down is nearer (half a metre each).
  if (phase === 'realRoom' && usable.includes('far') && usable.includes('near')) return key === 'up' ? 'far' : 'near';
  // Yes comes before Next so a summary's speed offer can be accepted with the keys.
  const candidates: Action[] = key === 'up' ? ['click', 'acceptStretch', 'next', 'answer'] : phase === 'feedback' ? ['next', 'replay', 'answer'] : ['replay', 'next', 'answer'];
  return candidates.find((a) => usable.includes(a)) ?? null;
}

/** True for a fresh press, false for a held key's repeats, which would re-render the sound over and over. */
export function createVolumeKeyGuard(minGapMs: number, now: () => number = () => performance.now()): (key: 'up' | 'down') => boolean {
  const last: Record<'up' | 'down', number> = { up: -Infinity, down: -Infinity };
  return (key) => {
    const t = now();
    const fresh = t - last[key] >= minGapMs;
    last[key] = t;
    return fresh;
  };
}

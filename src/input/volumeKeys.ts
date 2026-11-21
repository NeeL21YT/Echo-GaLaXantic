// Volume buttons as controls (§13.3). Pure mapping; the native plugin delivers the key events.
import type { Action } from '../state/store';

/** Up is "do the main thing" (click, continue, begin); down is "again" (replay, then next). */
export function actionForVolumeKey(key: 'up' | 'down', valid: readonly Action[], inReadyPhase: boolean): Action | null {
  // Replay works in the ready phase too, but the buttons only list it after an answer.
  const usable = inReadyPhase ? [...valid, 'replay' as const] : valid;
  const candidates: Action[] = key === 'up' ? ['click', 'next', 'answer'] : ['replay', 'next', 'answer'];
  return candidates.find((a) => usable.includes(a)) ?? null;
}

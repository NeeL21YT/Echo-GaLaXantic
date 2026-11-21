// Vibration patterns for "feel the answer" (§13.9). Pure lookup so the set can be tested for distinctness.
import { HAPTIC } from '../config';
import type { Action } from '../state/store';

export type HapticKind = 'left' | 'right' | 'near' | 'far' | 'pass' | 'miss' | 'bump';

export const hapticPattern = (kind: HapticKind): number[] => [...HAPTIC[kind]];

/** The pattern that confirms an answer action, or null for actions that have none. */
export function hapticKindForAction(action: Action): HapticKind | null {
  return action === 'left' || action === 'right' || action === 'near' || action === 'far' ? action : null;
}

// Plays "feel the answer" vibrations when the setting is on (§13.9).
import { vibrate } from '../native/echoNative';
import { hapticKindForAction, hapticPattern, type HapticKind } from '../speech/hapticPatterns';
import { useEcho, type Action } from './store';

export function feel(kind: HapticKind): void {
  if (!useEcho.getState().settings.haptics) return;
  void vibrate(hapticPattern(kind));
}

export function feelAnswer(action: Action): void {
  const kind = hapticKindForAction(action);
  if (kind) feel(kind);
}

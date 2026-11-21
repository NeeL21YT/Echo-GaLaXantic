// What "Back" means everywhere (§13.11): the on-screen Back button, the phone's back button and the back swipe.
// One step up, never a surprise exit. Only the level list asks twice before closing the app.
import type { Phase } from '../state/store';

export type BackStep = 'closeSettings' | 'levelList' | 'confirmExit';

export function backStep(phase: Phase, settingsOpen: boolean): BackStep {
  if (settingsOpen) return 'closeSettings';
  // The level list (and first-run setup) is the top: there is nothing above it to go back to.
  return phase === 'levelSelect' || phase === 'onboarding' ? 'confirmExit' : 'levelList';
}

/** Press Back twice within this long on the top screen to close the app. */
export const EXIT_CONFIRM_MS = 2500;

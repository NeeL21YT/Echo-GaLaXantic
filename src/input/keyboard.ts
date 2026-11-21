// Scoped keyboard shortcuts (§9.3). Attached to the practice container, never to window.
import type { Action } from '../state/store';
import { LEVELS } from '../levels';
import type { KeyboardCommand, KeyboardContext, OnboardingAction } from '../types';

const KEY_MAP: Record<string, Action> = {
  ' ': 'click',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  '1': 'near',
  '2': 'far',
  a: 'turnLeft',
  d: 'turnRight',
  w: 'stepForward',
  s: 'stepBack',
  Enter: 'answer',
  r: 'replay',
  c: 'contrast',
  n: 'next',
  y: 'acceptStretch',
  v: 'observer',
  h: 'help',
  Escape: 'levelSelect',
};

// Only the real-room check knows these; elsewhere the same keys stay unassigned, as they were before places existed.
const ROOM_KEYS: Record<string, Action> = {
  '3': 'markWall',
  '4': 'markDoorway',
  '5': 'markStep',
  '6': 'markObstacle',
  m: 'mark',
  p: 'savePlace',
};

/** The KeyboardEvent.key that triggers each action; levels' answerKeys use the same names. */
export const ACTION_KEY: Partial<Record<Action, string>> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([key, action]) => [action, key]),
);

export function commandForKey(key: string, context: KeyboardContext, buttonFocused = false): KeyboardCommand | null {
  const normalized = key.toLowerCase();
  const setup = (action: OnboardingAction): KeyboardCommand => ({ type: 'onboarding', action });
  // Start must also consume Tab and native button keys so the first gesture cannot choose the next step.
  if (context === 'start') return setup('start');
  if (buttonFocused && (key === ' ' || key === 'Enter')) return null;
  switch (context) {
    case 'onboarding':
      return null;
    case 'narration':
      return normalized === 'y' ? setup('screenreader') : normalized === 'n' ? setup('voice') : null;
    case 'headphones':
      return key === 'ArrowLeft' ? setup('left') : key === 'ArrowRight' ? setup('right') : null;
    case 'mic':
      if (key === 'Enter' || normalized === 'n') return setup('skipMic');
      return normalized === 'm' ? setup('enableMic') : null;
    case 'micTest':
      return key === 'Enter' ? setup('done') : null;
    case 'levelSelect': {
      const level = LEVELS.find((candidate) => String(candidate.id) === key);
      if (level) return { type: 'level', levelId: level.id };
    }
  }
  const roomKey = context === 'realRoom' ? ROOM_KEYS[key] ?? ROOM_KEYS[normalized] : undefined;
  const action = roomKey ?? KEY_MAP[key] ?? KEY_MAP[normalized];
  return action ? { type: 'action', action } : null;
}

function isTextEntry(el: Element | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

/** Both setup and practice use the same native-button and repeat rules. */
export function attachKeyboard(
  el: HTMLElement,
  context: () => KeyboardContext,
  onCommand: (command: KeyboardCommand) => boolean,
): () => void {
  const listener = (e: KeyboardEvent) => {
    if (e.repeat) {
      // Native buttons also repeat on Enter unless its default action is suppressed.
      e.preventDefault();
      return;
    }
    const current = context();
    if (current !== 'start' && (e.altKey || e.ctrlKey || e.metaKey)) return;
    const target = e.target instanceof Element ? e.target : null;
    if (isTextEntry(target)) return;
    const command = commandForKey(e.key, current, target instanceof HTMLButtonElement);
    if (command && onCommand(command)) e.preventDefault();
  };
  el.addEventListener('keydown', listener);
  return () => el.removeEventListener('keydown', listener);
}

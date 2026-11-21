// Scoped keyboard shortcuts (§9.3). Attached to the practice container, never to window.
import type { Action } from '../state/store';

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

/** The KeyboardEvent.key that triggers each action; levels' answerKeys use the same names. */
export const ACTION_KEY: Partial<Record<Action, string>> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([key, action]) => [action, key]),
);

export function actionForKey(key: string): Action | null {
  return KEY_MAP[key.length === 1 ? key.toLowerCase() : key] ?? null;
}

function isTextEntry(el: Element | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

/** Attaches the handler; returns a detach function. `onAction` returns true when it used the key. */
export function attachKeyboard(el: HTMLElement, onAction: (action: Action) => boolean): () => void {
  const listener = (e: KeyboardEvent) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (isTextEntry(target)) return;
    // A focused button already acts on Space/Enter natively; handling it here too would fire twice.
    if (target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
    const action = actionForKey(e.key);
    if (action && onAction(action)) e.preventDefault();
  };
  el.addEventListener('keydown', listener);
  return () => el.removeEventListener('keydown', listener);
}

// Real buttons for every action (§9.2). Keys are shortcuts on top of these, never the only way.
import type { Action } from '../state/store';
import { ACTION_LABELS } from './labels';

type Props = {
  actions: readonly Action[];
  onAction: (action: Action) => void;
  disabled?: readonly Action[];
};

export function Controls({ actions, onAction, disabled = [] }: Props) {
  return (
    <nav className="controls" aria-label="Controls">
      {actions.map((a) => {
        const { label, key } = ACTION_LABELS[a];
        return (
          <button key={a} type="button" onClick={() => onAction(a)} disabled={disabled.includes(a)}>
            {label}
            {key && <span className="key-hint"> ({key})</span>}
          </button>
        );
      })}
    </nav>
  );
}

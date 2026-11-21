// Real buttons for every action (§9.2). Keys are shortcuts on top of these, never the only way.
import type { Action } from '../state/store';
import { ACTION_LABELS } from './labels';

type Props = {
  actions: readonly Action[];
  onAction: (action: Action) => void;
  disabled?: readonly Action[];
  /** Phase-specific wording, e.g. "Begin" for Enter during the intro. */
  labels?: Partial<Record<Action, string>>;
};

export function Controls({ actions, onAction, disabled = [], labels = {} }: Props) {
  return (
    <nav className="controls" aria-label="Controls">
      {actions.map((a) => {
        const { key } = ACTION_LABELS[a];
        const label = labels[a] ?? ACTION_LABELS[a].label;
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

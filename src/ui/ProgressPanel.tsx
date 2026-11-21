// Per-level scores as plain text (§8.3). No charts: everything here must read well to a screen reader.
import { LEVELS } from '../levels';
import { levelStats } from '../state/progress';
import { useEcho } from '../state/store';

const fmt = (s: { score: number; total: number } | null) => (s ? `${s.score} out of ${s.total}` : 'none yet');

export function ProgressPanel() {
  const stretch = useEcho((s) => s.settings.stretch);
  return (
    <section className="progress-panel" aria-label="Your progress">
      <h2>Your progress</h2>
      <ul>
        {LEVELS.map((level) => {
          const st = levelStats(level.id, stretch);
          return (
            <li key={level.id}>
              Level {level.id}: last {fmt(st.lastScore)}, previous {fmt(st.prevScore)}, best {fmt(st.bestScore)}.
            </li>
          );
        })}
      </ul>
    </section>
  );
}

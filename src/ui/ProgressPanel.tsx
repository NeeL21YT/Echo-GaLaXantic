// Per-level scores as plain text (§8.3). No charts: everything here must read well to a screen reader.
import { LEVELS } from '../levels';
import { levelStats } from '../state/progress';
import { useEcho } from '../state/store';
import { progressLine } from './labels';

export function ProgressPanel() {
  const stretch = useEcho((s) => s.settings.stretch);
  // Subscribed so the list refreshes after Reset progress.
  useEcho((s) => s.progressVersion);
  const lines = LEVELS.map((level) => ({ id: level.id, text: progressLine(level.id, levelStats(level.id, stretch)) }))
    .filter((line): line is { id: typeof line.id; text: string } => line.text !== null);
  return (
    <section className="progress-panel" aria-label="Your progress">
      <h2>Your progress</h2>
      {lines.length === 0 ? (
        <p>No scores yet.</p>
      ) : (
        <ul>
          {lines.map((line) => (
            <li key={line.id}>{line.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

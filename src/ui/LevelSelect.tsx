import { LEVELS } from '../levels';
import { levelStats } from '../state/progress';
import { startLevel } from '../state/runner';
import { useEcho } from '../state/store';

export function LevelSelect() {
  const stretch = useEcho((s) => s.settings.stretch);
  return (
    <nav className="level-select" aria-label="Levels">
      {LEVELS.map((level) => {
        const stats = levelStats(level.id, stretch);
        const best = stats.bestScore ? ` · Best ${stats.bestScore.score} of ${stats.bestScore.total}` : '';
        return (
          <button key={level.id} type="button" onClick={() => void startLevel(level.id)}>
            Level {level.id}: {level.title} — {level.skill}
            {best}
          </button>
        );
      })}
    </nav>
  );
}

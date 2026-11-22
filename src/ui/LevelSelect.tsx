import { LESSONS } from '../levels/lessons';
import { LEVELS } from '../levels';
import { spokenNumber } from '../levels/feedback';
import { getLessonsDone, levelStats } from '../state/progress';
import { startLesson } from '../state/lessonRunner';
import { realRoomAvailable } from '../input/platform';
import { startRoom } from '../state/roomRunner';
import { startLevel } from '../state/runner';
import { useEcho } from '../state/store';
import { SetupSummary } from './SetupSummary';

type CardProps = { title: string; sub: string; badge?: string; quiet?: boolean; keyHint?: string; onClick: () => void };

function Card({ title, sub, badge, quiet, keyHint, onClick }: CardProps) {
  return (
    <button type="button" className="card" onClick={onClick}>
      <span className="card-title">
        {title}
        {keyHint && <span className="key-hint"> ({keyHint})</span>}
      </span>
      <span className="card-sub">{sub}</span>
      {badge && <span className={quiet ? 'badge quiet' : 'badge'}>{badge}</span>}
    </button>
  );
}

export function LevelSelect() {
  const stretch = useEcho((s) => s.settings.stretch);
  // Reset progress bumps this, so scores and Done badges are read again.
  useEcho((s) => s.progressVersion);
  const done = getLessonsDone();
  return (
    <>
      <nav className="level-select" aria-label="Setup status">
        <SetupSummary />
      </nav>
      <nav className="level-select" aria-label="Lessons">
        <h2>Learn</h2>
        {LESSONS.map((lesson) => (
          <Card
            key={lesson.id}
            title={`Lesson ${lesson.id}: ${lesson.title}`}
            sub={typeof lesson.practiceLevel === 'number' ? `Leads into Level ${spokenNumber(lesson.practiceLevel)}` : lesson.id === 1 ? 'Technique, with a click coach' : 'Take it into a real room'}
            badge={done.includes(lesson.id) ? 'Done' : undefined}
            onClick={() => startLesson(lesson.id)}
          />
        ))}
      </nav>
      {realRoomAvailable() && (
        <nav className="level-select" aria-label="Real room">
          <h2>Real room</h2>
          <Card
            title="Real room check"
            sub="Guess how far a wall is, then hear the measured distance."
            onClick={() => startRoom()}
          />
        </nav>
      )}
      <nav className="level-select" aria-label="Practise">
        <h2>Practise</h2>
        {LEVELS.map((level) => {
          const stats = levelStats(level.id, stretch);
          const best = stats.bestScore ? `Best ${spokenNumber(stats.bestScore.score)} of ${spokenNumber(stats.bestScore.total)}` : undefined;
          return (
            <Card
              key={level.id}
              title={`Level ${spokenNumber(level.id)}: ${level.title}`}
              sub={level.skill}
              badge={best ?? 'New'}
              quiet={!best}
              keyHint={String(level.id)}
              onClick={() => void startLevel(level.id)}
            />
          );
        })}
      </nav>
    </>
  );
}

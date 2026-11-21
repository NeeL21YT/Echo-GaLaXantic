import { LESSONS } from '../levels/lessons';
import { LEVELS } from '../levels';
import { getLessonsDone, levelStats } from '../state/progress';
import { startLesson } from '../state/lessonRunner';
import { startRoom } from '../state/roomRunner';
import { startLevel } from '../state/runner';
import { useEcho } from '../state/store';
import { SetupSummary } from './SetupSummary';

type CardProps = { title: string; sub: string; badge?: string; quiet?: boolean; onClick: () => void };

function Card({ title, sub, badge, quiet, onClick }: CardProps) {
  return (
    <button type="button" className="card" onClick={onClick}>
      <span className="card-title">{title}</span>
      <span className="card-sub">{sub}</span>
      {badge && <span className={quiet ? 'badge quiet' : 'badge'}>{badge}</span>}
    </button>
  );
}

export function LevelSelect() {
  const stretch = useEcho((s) => s.settings.stretch);
  const done = getLessonsDone();
  return (
    <>
      <nav className="level-select" aria-label="Setup">
        <SetupSummary />
      </nav>
      <nav className="level-select" aria-label="Lessons">
        <h2>Learn</h2>
        {LESSONS.map((lesson) => (
          <Card
            key={lesson.id}
            title={`Lesson ${lesson.id}: ${lesson.title}`}
            sub={lesson.practiceLevel !== null ? `Leads into Level ${lesson.practiceLevel}` : lesson.id === 1 ? 'Technique, with a click coach' : 'Take it into a real room'}
            badge={done.includes(lesson.id) ? 'Done' : undefined}
            onClick={() => startLesson(lesson.id)}
          />
        ))}
      </nav>
      <nav className="level-select" aria-label="Real room">
        <h2>Real room</h2>
        <Card
          title="Real room check"
          sub="Guess the distance to a wall, then hear the real one"
          onClick={() => startRoom()}
        />
      </nav>
      <nav className="level-select" aria-label="Levels">
        <h2>Practise</h2>
        {LEVELS.map((level) => {
          const stats = levelStats(level.id, stretch);
          const best = stats.bestScore ? `Best ${stats.bestScore.score} of ${stats.bestScore.total}` : undefined;
          return (
            <Card
              key={level.id}
              title={`Level ${level.id}: ${level.title}`}
              sub={level.skill}
              badge={best ?? 'New'}
              quiet={!best}
              onClick={() => void startLevel(level.id)}
            />
          );
        })}
      </nav>
    </>
  );
}

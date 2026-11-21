import { LESSONS } from '../levels/lessons';
import { LEVELS } from '../levels';
import { getLessonsDone, levelStats } from '../state/progress';
import { startLesson } from '../state/lessonRunner';
import { startLevel } from '../state/runner';
import { useEcho } from '../state/store';

export function LevelSelect() {
  const stretch = useEcho((s) => s.settings.stretch);
  const done = getLessonsDone();
  return (
    <>
      <nav className="level-select" aria-label="Lessons">
        <h2>Learn</h2>
        {LESSONS.map((lesson) => (
          <button key={lesson.id} type="button" onClick={() => startLesson(lesson.id)}>
            Lesson {lesson.id}: {lesson.title}
            {done.includes(lesson.id) ? ' · Done' : ''}
          </button>
        ))}
      </nav>
      <nav className="level-select" aria-label="Levels">
        <h2>Practise</h2>
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
    </>
  );
}

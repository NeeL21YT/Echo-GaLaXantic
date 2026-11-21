// Teaching flow (§13.7): lesson → pages → (say | demo)*, then wait for Continue. Shares the runner's narration
// routing and render path so a lesson example is exactly what a level would play.
import { CLICK_COACH, CONTRAST_PAUSE_MS } from '../config';
import { startClickCoach, stopClickCoach } from '../audio/clickCoach';
import { play, stopAll } from '../audio/player';
import { correct } from '../audio/sfx';
import { getLesson, LESSONS, type LessonPage } from '../levels/lessons';
import { CLICK_ADVICE } from '../speech/clickText';
import { markLessonDone } from './progress';
import { renderFrom, say, sayLabel, silenceSpeech, startLevel } from './runner';
import { useEcho, type Action } from './store';

const S = () => useEcho.getState();

let pageJob = 0;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Fixed seed: a lesson example must sound identical every time it is heard. */
const DEMO_SEED = 0x1e550;

let endCoachWait: (() => void) | null = null;

/** Stops the mic and releases a page that is waiting on the coach. */
function endCoach(): void {
  stopClickCoach();
  endCoachWait?.();
  endCoachWait = null;
}

/** Listens to the learner's own clicks and tells them how each one sounded, until enough are good or the page ends. */
async function runCoach(goodNeeded: number, job: number): Promise<void> {
  let good = 0;
  let tries = 0;
  let missesInRow = 0;
  const finished = new Promise<void>((resolve) => {
    endCoachWait = resolve;
  });
  try {
    await startClickCoach((report) => {
      if (job !== pageJob) return;
      tries += 1;
      if (report.verdict === 'good') {
        good += 1;
        missesInRow = 0;
        // A tone, not speech, so a run of good clicks isn't interrupted.
        void correct();
        if (good >= goodNeeded) {
          stopClickCoach();
          void say(`${good} good clicks out of ${tries}. Nice work. Press Continue.`).then(() => endCoachWait?.());
        }
        return;
      }
      missesInRow += 1;
      if (missesInRow >= CLICK_COACH.missesBeforeOffer) {
        missesInRow = 0;
        void say('Take a breath. Rest your tongue tip just behind your top front teeth, then pull it down sharply. Or press Continue to move on.');
      } else {
        void say(CLICK_ADVICE[report.verdict]);
      }
    });
  } catch {
    await say('The microphone is blocked, so I cannot hear your clicks. Practise without me: click ten times, slowly, and listen to each one. Press Continue when you are ready.');
    return;
  }
  await finished;
}

async function playPage(page: LessonPage, job: number): Promise<void> {
  await silenceSpeech();
  for (const step of page) {
    if (job !== pageJob) return;
    if (step.kind === 'say') {
      await say(step.text);
    } else if (step.kind === 'coach') {
      await runCoach(step.goodNeeded, job);
    } else {
      await sayLabel(step.label);
      if (job !== pageJob) return;
      const { buffer } = await renderFrom(step.world, step.pose, DEMO_SEED);
      if (job !== pageJob) return;
      await play(buffer);
      await sleep(CONTRAST_PAUSE_MS);
    }
  }
}

function present(): void {
  const st = S();
  if (st.lessonId === null) return;
  const lesson = getLesson(st.lessonId);
  const page = lesson.pages[st.lessonPage];
  if (!page) return;
  const job = ++pageJob;
  stopAll();
  endCoach();
  void playPage(page, job);
}

export function startLesson(id: number): void {
  pageJob++;
  stopAll();
  endCoach();
  S().patch({ phase: 'lesson', lessonId: id, lessonPage: 0, levelId: null, trial: null, lastHits: [], lastPose: null });
  present();
}

function isLastPage(): boolean {
  const st = S();
  return st.lessonId !== null && st.lessonPage >= getLesson(st.lessonId).pages.length - 1;
}

async function leaveLesson(): Promise<void> {
  pageJob++;
  stopAll();
  endCoach();
  S().patch({ phase: 'levelSelect', lessonId: null, lessonPage: 0 });
  await say('Choose a lesson or a level.');
}

/** Handles an action while a lesson is open; returns true when the action was used. */
export function lessonAction(action: Action): boolean {
  const st = S();
  if (st.phase !== 'lesson' || st.lessonId === null) return false;
  const lesson = getLesson(st.lessonId);
  switch (action) {
    case 'next':
      if (isLastPage()) {
        markLessonDone(lesson.id);
        const nextLesson = LESSONS.find((l) => l.id === lesson.id + 1);
        if (nextLesson) startLesson(nextLesson.id);
        else void leaveLesson();
      } else {
        st.patch({ lessonPage: st.lessonPage + 1 });
        present();
      }
      return true;
    case 'replay':
      present();
      return true;
    case 'answer':
      // "Practise this" on the last page of a lesson that has a matching level.
      if (isLastPage() && lesson.practiceLevel !== null) {
        markLessonDone(lesson.id);
        void startLevel(lesson.practiceLevel);
        return true;
      }
      return false;
    case 'levelSelect':
      void leaveLesson();
      return true;
    case 'help':
      void say('Continue goes to the next page. Hear again repeats this page. Levels leaves the lesson.');
      return true;
    default:
      return false;
  }
}

export function lessonActions(): Action[] {
  const st = S();
  if (st.lessonId === null) return ['levelSelect'];
  const lesson = getLesson(st.lessonId);
  const practise = isLastPage() && lesson.practiceLevel !== null ? (['answer'] as const) : [];
  return ['next', 'replay', ...practise, 'help', 'levelSelect'];
}

// Teaching flow (§13.7): lesson → pages → (say | demo)*, then a spoken "what to press next" and a wait for the learner.
// Shares the runner's narration routing and render path so a lesson example is exactly what a level would play.
// Every page carries a job number; anything that leaves or restarts the page bumps it, so stale speech, sounds and
// the microphone can never carry on behind the learner's back.
import { CLICK_COACH, COACH_QUIET_AFTER_TONE_MS, CONTRAST_PAUSE_MS } from '../config';
import { startClickCoach, stopClickCoach } from '../audio/clickCoach';
import { play, stopAll } from '../audio/player';
import { correct } from '../audio/sfx';
import { currentInputStyle } from '../input/inputStyle';
import { realRoomAvailable } from '../input/platform';
import { getLesson, LESSONS, type LessonDef, type LessonPage } from '../levels/lessons';
import { CLICK_ADVICE } from '../speech/clickText';
import {
  COACH_BREATH, COACH_LISTENING, COACH_MIC_OFF, COACH_NO_MIC, coachDone, helpThenAgain, lessonHelp, lessonOpening, pageHint,
} from '../speech/lessonText';
import { cancel } from '../speech/narrator';
import { markLessonDone } from './progress';
import { startRoom } from './roomRunner';
import { ensureMicPermission, goToLevelSelect, renderFrom, say, sayLabel, silenceSpeech, startLevel } from './runner';
import { estimateReadMs, sayAndSettle, settleMicRefusal } from './settle';
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
  const alive = () => job === pageJob;
  let good = 0;
  let tries = 0;
  let missesInRow = 0;
  /** Clicks heard before this moment are our own tone or voice leaking into the mic, not the learner. */
  let quietUntil = 0;
  let finish: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
    endCoachWait = resolve;
  });

  if (!(await ensureMicPermission())) {
    // The runner has just explained the refusal, so only the way forward is added.
    await settleMicRefusal(alive);
    if (alive()) await sayAndSettle(COACH_MIC_OFF, alive);
    return;
  }
  if (!alive()) return;
  try {
    await startClickCoach((report) => {
      if (!alive() || Date.now() < quietUntil) return;
      tries += 1;
      if (report.verdict === 'good') {
        good += 1;
        missesInRow = 0;
        // A tone, not speech, so a run of good clicks isn't interrupted; the mic must not take it for a click.
        quietUntil = Date.now() + COACH_QUIET_AFTER_TONE_MS;
        void correct();
        if (good >= goodNeeded) {
          stopClickCoach();
          void sayAndSettle(coachDone(good, tries), alive).then(finish);
        }
        return;
      }
      missesInRow += 1;
      let advice = CLICK_ADVICE[report.verdict];
      if (missesInRow >= CLICK_COACH.missesBeforeOffer) {
        missesInRow = 0;
        advice = COACH_BREATH;
      }
      // With a screen reader the phone's speaker reads the advice aloud, and the mic would hear it.
      if (S().settings.narration === 'screenreader') quietUntil = Date.now() + estimateReadMs(advice);
      void say(advice);
    });
  } catch {
    if (alive()) await sayAndSettle(COACH_NO_MIC, alive);
    return;
  }
  if (!alive()) return;
  quietUntil = Date.now() + (S().settings.narration === 'screenreader' ? estimateReadMs(COACH_LISTENING) : 0);
  await say(COACH_LISTENING);
  await finished;
}

async function playPage(page: LessonPage, job: number, opening: string | null): Promise<void> {
  const alive = () => job === pageJob;
  await silenceSpeech();
  if (opening) await sayAndSettle(opening, alive);
  for (const step of page) {
    if (!alive()) return;
    if (step.kind === 'say') {
      await sayAndSettle(step.text, alive);
    } else if (step.kind === 'coach') {
      await runCoach(step.goodNeeded, job);
    } else {
      await sayLabel(step.label);
      if (!alive()) return;
      const { buffer } = await renderFrom(step.world, step.pose, DEMO_SEED);
      if (!alive()) return;
      // A focus label may have started while the offline render was pending.
      await silenceSpeech();
      if (!alive()) return;
      await play(buffer);
      if (!alive()) return;
      await sleep(CONTRAST_PAUSE_MS);
    }
  }
  if (!alive()) return;
  const st = S();
  if (st.lessonId === null) return;
  const lesson = getLesson(st.lessonId);
  await say(pageHint(currentInputStyle(), {
    page: st.lessonPage + 1,
    pages: lesson.pages.length,
    practiceLevel: practiceTarget(lesson),
    hasNextLesson: LESSONS.some((l) => l.id === lesson.id + 1),
  }));
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
  void playPage(page, job, st.lessonPage === 0 ? lessonOpening(lesson.id, lesson.title) : null).catch((err: unknown) => {
    console.error(err);
    if (job === pageJob) void say('Something went wrong with this page. You can hear it again, or go back to the level list.', { isError: true });
  });
}

/** Stops everything a lesson started: its page, its sounds, its speech and the click-coach microphone. */
export function abortTeaching(): void {
  pageJob++;
  stopAll();
  endCoach();
  cancel();
  if (S().lessonId !== null) S().patch({ lessonId: null, lessonPage: 0 });
}

export function startLesson(id: number): void {
  pageJob++;
  stopAll();
  endCoach();
  S().patch({ phase: 'lesson', lessonId: id, lessonPage: 0, levelId: null, trial: null, lastHits: [], lastPose: null });
  present();
}

/** Where "Practise this" leads. The real room check is a phone feature, so on a desktop lesson 6 simply ends. */
function practiceTarget(lesson: LessonDef): LessonDef['practiceLevel'] {
  return lesson.practiceLevel === 'room' && !realRoomAvailable() ? null : lesson.practiceLevel;
}

function isLastPage(): boolean {
  const st = S();
  return st.lessonId !== null && st.lessonPage >= getLesson(st.lessonId).pages.length - 1;
}

async function leaveLesson(): Promise<void> {
  pageJob++;
  stopAll();
  endCoach();
  S().patch({ lessonId: null, lessonPage: 0 });
  await goToLevelSelect();
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
      if (isLastPage() && practiceTarget(lesson) !== null) {
        markLessonDone(lesson.id);
        // The page may still be speaking; it must not carry on over the level's own introduction.
        abortTeaching();
        const target = practiceTarget(lesson);
        if (target === 'room') startRoom();
        else if (target !== null) void startLevel(target);
        return true;
      }
      return false;
    case 'levelSelect':
      void leaveLesson();
      return true;
    case 'help': {
      // Help stops the page, or the page's next sentence would cut the help off.
      pageJob++;
      stopAll();
      endCoach();
      const style = currentInputStyle();
      void say(`${lessonHelp(style)} ${helpThenAgain(style)}`);
      return true;
    }
    default:
      return false;
  }
}

export function lessonActions(): Action[] {
  const st = S();
  if (st.lessonId === null) return ['levelSelect'];
  const lesson = getLesson(st.lessonId);
  const practise = isLastPage() && practiceTarget(lesson) !== null ? (['answer'] as const) : [];
  return ['next', 'replay', ...practise, 'help', 'levelSelect'];
}

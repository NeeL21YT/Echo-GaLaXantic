// What a lesson says about itself and how to move on, in the words of the way the learner controls Echo (§13.7).
// The lesson pages carry the teaching; this carries the "what can I do now" that every page must end with.
import type { InputStyle } from './inputText';

export type PageInfo = {
  /** 1-based. */
  page: number;
  pages: number;
  /** Level that practises this lesson, or null. */
  practiceLevel: number | 'room' | null;
  hasNextLesson: boolean;
};

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const spoken = (n: number): string => WORDS[n] ?? String(n);

export function lessonOpening(id: number, title: string): string {
  return `Lesson ${spoken(id)}. ${title}.`;
}

/** Spoken when a page has finished, so the learner always knows what to press next. */
export function pageHint(style: InputStyle, info: PageInfo): string {
  const where = `Page ${spoken(info.page)} of ${spoken(info.pages)}.`;
  const last = info.page >= info.pages;
  // The real room check has no level number, so it gets its own wording.
  const room = info.practiceLevel === 'room';
  const practise = room ? 'open the real room check' : `practise Level ${typeof info.practiceLevel === 'number' ? spoken(info.practiceLevel) : ''}`;
  if (style === 'keys') {
    if (!last) return `${where} Press N for the next page, or R to hear this page again.`;
    if (info.practiceLevel !== null) {
      return `${where} Press Enter to ${practise}. Press N for the next lesson, R to hear this page again, or Escape for the level list.`;
    }
    return info.hasNextLesson
      ? `${where} Press N for the next lesson, R to hear this page again, or Escape for the level list.`
      : `${where} Press N or Escape for the level list, or R to hear this page again.`;
  }
  if (style === 'touch') {
    if (!last) return `${where} Press and hold for the next page, or double tap to hear this page again.`;
    if (info.practiceLevel !== null) {
      return `${where} Press and hold to ${practise}. Double tap to hear this page again, or tap with three fingers for the level list.`;
    }
    return info.hasNextLesson
      ? `${where} Press and hold for the next lesson, or double tap to hear this page again.`
      : `${where} Press and hold for the level list, or double tap to hear this page again.`;
  }
  if (!last) return `${where} Choose Continue for the next page, or Hear again.`;
  if (info.practiceLevel !== null) {
    return `${where} Choose Practise this skill to ${practise}, Continue for the next lesson, or Hear again.`;
  }
  return info.hasNextLesson
    ? `${where} Choose Continue for the next lesson, or Hear again.`
    : `${where} Choose Continue for the level list, or Hear again.`;
}

export function lessonHelp(style: InputStyle): string {
  if (style === 'keys') {
    return 'N goes to the next page. R hears this page again. On the last page, Enter chooses Practise this skill. Escape goes to the level list.';
  }
  if (style === 'touch') {
    return 'Press and hold to go on. On the last page, press and hold chooses Practise this skill. Double tap to hear this page again. Tap with three fingers for the level list. Tap with two fingers for this help.';
  }
  return 'Every action is a button: Continue, Hear again, Practise this skill on the last page, Help and Levels.';
}

/** Said after help, because help stops the page. */
export function helpThenAgain(style: InputStyle): string {
  if (style === 'keys') return 'Press R to hear the page again.';
  return style === 'touch' ? 'Double tap to hear the page again.' : 'Choose Hear again to hear the page again.';
}

export const COACH_LISTENING = 'I am listening. Click your tongue.';

export function coachDone(good: number, tries: number): string {
  return `${spoken(good)} good clicks out of ${spoken(tries)}. Nice work.`;
}

/** When the runner has already explained a refused microphone, only the way forward is added. */
export const COACH_PRACTISE_ALONE = 'Practise without me: click ten times, slowly, and listen to each one.';

/** Permission refused: the lesson says so, says how to allow it, and lets the learner practise unmonitored. */
export const COACH_MIC_OFF =
  'The microphone is off, so I cannot hear your clicks. Practise ten slow clicks on your own, then choose Continue. To allow the microphone, use the Open settings button.';

export const COACH_NO_MIC = `I cannot use the microphone, so I cannot hear your clicks. ${COACH_PRACTISE_ALONE}`;

export const COACH_BREATH =
  'Take a breath. Rest your tongue tip just behind your top front teeth, then pull it down sharply. Or move on to the next page.';

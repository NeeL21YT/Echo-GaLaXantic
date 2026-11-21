// Volume buttons as a menu scanner (§13.3): on the level list, volume down moves to the next option and speaks it,
// volume up chooses the one you are on. Works without seeing the screen or touching it.
import { spokenLabel } from './readAloud';

const ITEMS = '.level-select button.card';
const CURRENT = 'scan-current';

/** Down steps forward and wraps; from "nothing chosen yet" (-1) it lands on the first option. */
export function nextScanIndex(current: number, count: number): number {
  if (count <= 0) return -1;
  return (current + 1) % count;
}

let current: HTMLElement | null = null;

function mark(el: HTMLElement | null): void {
  for (const old of document.querySelectorAll(`.${CURRENT}`)) old.classList.remove(CURRENT);
  current = el;
  if (el) {
    el.classList.add(CURRENT);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/** Returns true when the key was used. `speak` says a line aloud in whichever narration mode is on. */
export function scanMenu(key: 'up' | 'down', speak: (text: string) => void): boolean {
  const items = [...document.querySelectorAll<HTMLElement>(ITEMS)];
  if (items.length === 0) return false;
  const at = current ? items.indexOf(current) : -1;

  if (key === 'down') {
    const next = nextScanIndex(at, items.length);
    const el = items[next];
    if (!el) return false;
    mark(el);
    speak(`${spokenLabel(el)} ${next + 1} of ${items.length}.`);
    return true;
  }

  if (at < 0) {
    speak('Press volume down to move through the list. Press volume up to choose.');
    return true;
  }
  const chosen = items[at];
  mark(null);
  chosen?.click();
  return true;
}

export function clearScan(): void {
  mark(null);
}

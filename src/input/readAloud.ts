// Touch-and-hold to hear (§13.2): while a screen reader is off, holding a finger on a control reads it aloud
// instead of pressing it, so a blind user can feel their way around the screen. With TalkBack on the phone does this
// itself, so this stands down.
import { GESTURE } from '../config';

/** Things a touch-and-hold reads aloud. Gestures ignore touches that start on these, so a read never also fires an action. */
// The message is left out on purpose: it is the big touch surface, so a long press there is Answer or Next.
export const READABLE_SELECTOR = 'button, [role="button"], select, input, label, h2, li.chip';

/** What a person would hear for this element: its label, or what is visibly written on it. */
export function spokenLabel(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  // innerText skips text hidden with CSS (the key hints), which is exactly what should not be read out.
  // Line breaks between a card's title, subtitle and badge become sentence breaks, so they are not run together.
  const raw = aria ?? el.innerText ?? '';
  // CSS capitalises section headings, but a voice should read "learn", not spell out "LEARN".
  const plain = raw === raw.toUpperCase() && /[A-Z]{2}/.test(raw) ? raw.toLowerCase() : raw;
  const text = plain.replace(/([^.!?:\s])\s*\n+\s*/g, '$1. ').replace(/\s+/g, ' ').trim();
  const unavailable = el instanceof HTMLButtonElement && el.disabled ? ' Not available yet.' : '';
  return text ? `${text.replace(/[.]$/, '')}.${unavailable}` : '';
}

type Options = {
  /** False while a screen reader is on or narration is not our own voice. */
  enabled: () => boolean;
  speak: (text: string) => void;
  onRead: () => void;
};

/** Attaches to the practice container; returns a detach function. */
export function attachReadAloud(container: HTMLElement, { enabled, speak, onRead }: Options): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;
  /** True from the moment a read fires until that touch ends. */
  let holding = false;
  /** The pointer was cancelled before the read fired, so no click can follow this touch. */
  let ended = false;
  let suppressUntil = 0;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  /** The touch has ended (lifted or cancelled): the click that may follow it must not press the control just read. */
  const finishTouch = () => {
    clearTimer();
    if (holding) {
      suppressUntil = performance.now() + GESTURE.suppressClickMs;
      holding = false;
    }
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    // A new touch starts clean: nothing from the last one may linger and swallow this one's click.
    holding = false;
    ended = false;
    // A leftover timer from an earlier touch, or a second finger, must not read or arm the click guard.
    clearTimer();
    if (!e.isPrimary || !enabled()) return;
    const target = e.target instanceof Element ? e.target.closest<HTMLElement>(READABLE_SELECTOR) : null;
    if (!target) return;
    startX = e.clientX;
    startY = e.clientY;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      const label = spokenLabel(target);
      if (!label) return;
      holding = !ended;
      speak(label);
      onRead();
    }, GESTURE.readAloudMs);
  };

  const move = (e: PointerEvent) => {
    // Moving away means a scroll or swipe, not a hold.
    if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > GESTURE.tapSlopPx) clearTimer();
  };

  // Android starts its own long-press handling (text selection, context menu) at about the same moment and may then
  // cancel the pointer. A cancel without movement is that, not a scroll, so it must not abort the read.
  const cancelled = () => {
    // No click follows a cancelled pointer, so nothing needs swallowing; arming the guard would eat the next real tap.
    if (holding) {
      clearTimer();
      holding = false;
    } else if (timer) ended = true; // let the pending read still fire; no click will follow a cancelled pointer
  };

  const contextMenu = (e: Event) => {
    if (e.target instanceof Element && e.target.closest(READABLE_SELECTOR) && enabled()) e.preventDefault();
  };

  const click = (e: MouseEvent) => {
    if (holding || performance.now() < suppressUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  container.addEventListener('pointerdown', down);
  container.addEventListener('pointermove', move);
  container.addEventListener('pointerup', finishTouch);
  container.addEventListener('pointercancel', cancelled);
  container.addEventListener('contextmenu', contextMenu);
  // Capture phase, so the guard runs before React sees the click.
  container.addEventListener('click', click, true);
  return () => {
    clearTimer();
    container.removeEventListener('pointerdown', down);
    container.removeEventListener('pointermove', move);
    container.removeEventListener('pointerup', finishTouch);
    container.removeEventListener('pointercancel', cancelled);
    container.removeEventListener('contextmenu', contextMenu);
    container.removeEventListener('click', click, true);
  };
}

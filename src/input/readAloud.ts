// Touch-and-hold to hear (§13.2): while a screen reader is off, holding a finger on a control reads it aloud
// instead of pressing it, so a blind user can feel their way around the screen. With TalkBack on the phone does this
// itself, so this stands down.
import { GESTURE } from '../config';

/** Things a touch-and-hold reads aloud. Gestures ignore touches that start on these, so a read never also fires an action. */
export const READABLE_SELECTOR = 'button, [role="button"], select, input, label, h2, li.chip, .blind-message';

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
  let suppressUntil = 0;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || !enabled()) return;
    const target = e.target instanceof Element ? e.target.closest<HTMLElement>(READABLE_SELECTOR) : null;
    if (!target) return;
    startX = e.clientX;
    startY = e.clientY;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      const label = spokenLabel(target);
      if (!label) return;
      suppressUntil = performance.now() + GESTURE.suppressClickMs + 1000; // lifted later; see the click guard
      speak(label);
      onRead();
    }, GESTURE.readAloudMs);
  };

  const move = (e: PointerEvent) => {
    if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > GESTURE.tapSlopPx) cancel();
  };

  const up = () => {
    cancel();
    // The lift of a read-aloud touch must not press the control it just read.
    if (suppressUntil > 0) suppressUntil = performance.now() + GESTURE.suppressClickMs;
  };

  const click = (e: MouseEvent) => {
    if (suppressUntil > 0 && performance.now() < suppressUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    suppressUntil = 0;
  };

  container.addEventListener('pointerdown', down);
  container.addEventListener('pointermove', move);
  container.addEventListener('pointerup', up);
  container.addEventListener('pointercancel', cancel);
  // Capture phase, so the guard runs before React sees the click.
  container.addEventListener('click', click, true);
  return () => {
    cancel();
    container.removeEventListener('pointerdown', down);
    container.removeEventListener('pointermove', move);
    container.removeEventListener('pointerup', up);
    container.removeEventListener('pointercancel', cancel);
    container.removeEventListener('click', click, true);
  };
}

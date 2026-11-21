// Touch gesture recognizer (§13.2). Pure: pointer events in, gestures out, timers injected so tests can drive time.
// With TalkBack on, the OS keeps raw touch for itself, so none of this fires; the real buttons are the way in.
import { GESTURE } from '../config';
import type { Action, Phase } from '../state/store';
import { READABLE_SELECTOR } from './readAloud';

export type Gesture =
  | { kind: 'tap'; count: number }
  | { kind: 'swipe'; dir: 'left' | 'right' | 'up' | 'down' }
  | { kind: 'longPress' }
  | { kind: 'multiFingerTap'; fingers: number };

export type Scheduler = (fn: () => void, ms: number) => () => void;

type Touch = { x: number; y: number; t: number };

type Options = {
  onGesture: (g: Gesture) => void;
  /** Highest tap count that currently has a valid action; at that count a tap fires without waiting. */
  maxTaps: () => number;
  schedule?: Scheduler;
};

const realSchedule: Scheduler = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export type Recognizer = {
  /** `allowLong` is false where a long press belongs to read-aloud instead. */
  down: (id: number, x: number, y: number, t: number, allowLong?: boolean) => void;
  move: (id: number, x: number, y: number) => void;
  up: (id: number, x: number, y: number, t: number) => void;
  /** Pass the event time so a cancel caused by Android's own long-press can be told from a real abort. */
  cancel: (t?: number) => void;
};

export function createRecognizer({ onGesture, maxTaps, schedule = realSchedule }: Options): Recognizer {
  const active = new Map<number, Touch>();
  let peakFingers = 0;
  let firstDownAt = 0;
  let moved = false;
  let tapCount = 0;
  let cancelTapTimer: (() => void) | null = null;
  let cancelLongPress: (() => void) | null = null;
  let longFired = false;
  /** The pointer was cancelled by the OS mid-hold; no lift will come, so the pending long press still has to finish the touch. */
  let holdCancelled = false;

  const flushTaps = () => {
    cancelTapTimer?.();
    cancelTapTimer = null;
    if (tapCount > 0) onGesture({ kind: 'tap', count: tapCount });
    tapCount = 0;
  };

  const reset = () => {
    active.clear();
    peakFingers = 0;
    moved = false;
    longFired = false;
    holdCancelled = false;
    cancelLongPress?.();
    cancelLongPress = null;
  };

  return {
    down(id, x, y, t, allowLong = true) {
      // A lift that never arrived would leave this touch counted as a second finger of the next one.
      if (holdCancelled || [...active.values()].some((a) => t - a.t > GESTURE.staleTouchMs)) reset();
      if (active.size === 0) {
        peakFingers = 0;
        moved = false;
        longFired = false;
        firstDownAt = t;
      }
      active.set(id, { x, y, t });
      peakFingers = Math.max(peakFingers, active.size);
      if (active.size === 1 && allowLong) {
        cancelLongPress?.();
        cancelLongPress = schedule(() => {
          if (active.size === 1 && !moved && peakFingers === 1) {
            longFired = true;
            // A long press ends any half-built multi-tap.
            cancelTapTimer?.();
            cancelTapTimer = null;
            tapCount = 0;
            onGesture({ kind: 'longPress' });
            if (holdCancelled) reset();
          } else if (holdCancelled) {
            reset();
          }
        }, GESTURE.longPressMs);
      }
    },

    move(id, x, y) {
      const start = active.get(id);
      if (!start) return;
      if (Math.hypot(x - start.x, y - start.y) > GESTURE.tapSlopPx) moved = true;
    },

    up(id, x, y, t) {
      const start = active.get(id);
      if (!start) return;
      active.delete(id);
      if (active.size > 0) return; // wait for the last finger
      cancelLongPress?.();
      cancelLongPress = null;

      const dx = x - start.x;
      const dy = y - start.y;
      const dist = Math.hypot(dx, dy);
      const duration = t - firstDownAt;

      if (longFired) {
        reset();
        return;
      }
      if (peakFingers > 1) {
        const ok = duration <= GESTURE.tapMaxMs + GESTURE.multiFingerWindowMs && !moved;
        const fingers = peakFingers;
        reset();
        if (ok) {
          flushTaps();
          onGesture({ kind: 'multiFingerTap', fingers });
        }
        return;
      }
      if (peakFingers === 1 && dist >= GESTURE.swipeMinPx && duration <= GESTURE.swipeMaxMs) {
        reset();
        flushTaps();
        const dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        onGesture({ kind: 'swipe', dir });
        return;
      }
      const isTap = dist <= GESTURE.tapSlopPx && duration <= GESTURE.tapMaxMs;
      reset();
      if (!isTap) return;
      tapCount += 1;
      cancelTapTimer?.();
      if (tapCount >= maxTaps()) {
        flushTaps();
      } else {
        cancelTapTimer = schedule(flushTaps, GESTURE.tapWindowMs);
      }
    },

    cancel(t) {
      const holding = cancelLongPress !== null && active.size === 1 && peakFingers === 1 && !moved && !longFired;
      if (t !== undefined && holding && t - firstDownAt >= GESTURE.cancelHoldMs) {
        holdCancelled = true;
        return;
      }
      reset();
      cancelTapTimer?.();
      cancelTapTimer = null;
      tapCount = 0;
    },
  };
}

/** Ordered candidates per gesture; the first one that is valid right now wins. */
export function candidatesFor(g: Gesture): Action[] {
  switch (g.kind) {
    case 'tap':
      return g.count === 1 ? ['click'] : g.count === 2 ? ['replay'] : ['contrast'];
    case 'swipe':
      if (g.dir === 'left') return ['left', 'turnLeft'];
      if (g.dir === 'right') return ['right', 'turnRight'];
      // "Up" means away: farther, or forward.
      return g.dir === 'up' ? ['far', 'stepForward'] : ['near', 'stepBack'];
    case 'longPress':
      // Yes comes before Next so a stretch offer on the summary can be accepted; a second hold then moves on.
      return ['answer', 'acceptStretch', 'next'];
    case 'multiFingerTap':
      return g.fingers === 2 ? ['help'] : ['levelSelect'];
  }
}

export function actionForGesture(g: Gesture, valid: readonly Action[]): Action | null {
  return candidatesFor(g).find((a) => valid.includes(a)) ?? null;
}

/** Help and the level list work in every phase but setup, so two- and three-finger taps always have an answer. */
export function gestureActions(phase: Phase, valid: readonly Action[]): Action[] {
  if (phase === 'onboarding') return [...valid];
  const extra: Action[] = phase === 'levelSelect' ? ['help'] : ['help', 'levelSelect'];
  return [...valid, ...extra.filter((a) => !valid.includes(a))];
}

/** Highest tap count that has a valid action, so a lone Click can fire without the multi-tap wait. */
export function maxTapsFor(valid: readonly Action[]): number {
  if (valid.includes('contrast')) return 3;
  if (valid.includes('replay')) return 2;
  return 1;
}

/** Real controls: a touch that starts on one is a press, never a gesture. */
const CONTROL_SELECTOR = 'button, [role="button"], select, input, label, a';

/** Attaches touch handling to the practice container; returns a detach function. */
export function attachGestures(
  el: HTMLElement,
  onAction: (a: Action) => boolean,
  getValid: () => readonly Action[],
  onTick: () => void,
  /** True while holding on a message or heading reads it aloud, so a long press there is not also an action. */
  readsAloud: () => boolean = () => false,
  /** A recognised gesture that maps to no valid action right now. */
  onIgnored: () => void = () => undefined,
): () => void {
  const rec = createRecognizer({
    maxTaps: () => maxTapsFor(getValid()),
    onGesture: (g) => {
      const action = actionForGesture(g, getValid());
      if (action && onAction(action)) onTick();
      else onIgnored();
    },
  });
  const closest = (e: PointerEvent, selector: string) => (e.target instanceof Element ? e.target.closest(selector) : null);
  const down = (e: PointerEvent) => {
    // Mouse and real controls keep their own behaviour. The message and chips do not: they cover most of the screen,
    // so taps and swipes there must still count; only a long press on them is left to read-aloud.
    if (e.pointerType === 'mouse' || closest(e, CONTROL_SELECTOR) !== null) return;
    const reads = readsAloud() && closest(e, READABLE_SELECTOR) !== null;
    rec.down(e.pointerId, e.clientX, e.clientY, e.timeStamp, !reads);
  };
  const move = (e: PointerEvent) => rec.move(e.pointerId, e.clientX, e.clientY);
  const up = (e: PointerEvent) => rec.up(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  // A scroll the browser takes over arrives as a cancel; count its last position so it is not mistaken for a hold.
  const cancel = (e: PointerEvent) => {
    rec.move(e.pointerId, e.clientX, e.clientY);
    rec.cancel(e.timeStamp);
  };
  // A long press on the gesture surface must not open Android's text-selection or context menu.
  const contextMenu = (e: Event) => {
    if (el.classList.contains('gesture-surface')) e.preventDefault();
  };
  el.addEventListener('contextmenu', contextMenu);
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('contextmenu', contextMenu);
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    rec.cancel();
  };
}

// Touch gesture recognizer (§13.2). Pure: pointer events in, gestures out, timers injected so tests can drive time.
// With TalkBack on, the OS keeps raw touch for itself, so none of this fires; the real buttons are the way in.
import { GESTURE } from '../config';
import type { Action } from '../state/store';

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
  down: (id: number, x: number, y: number, t: number) => void;
  move: (id: number, x: number, y: number) => void;
  up: (id: number, x: number, y: number, t: number) => void;
  cancel: () => void;
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
    cancelLongPress?.();
    cancelLongPress = null;
  };

  return {
    down(id, x, y, t) {
      if (active.size === 0) {
        peakFingers = 0;
        moved = false;
        longFired = false;
        firstDownAt = t;
      }
      active.set(id, { x, y, t });
      peakFingers = Math.max(peakFingers, active.size);
      if (active.size === 1) {
        cancelLongPress?.();
        cancelLongPress = schedule(() => {
          if (active.size === 1 && !moved && peakFingers === 1) {
            longFired = true;
            // A long press ends any half-built multi-tap.
            cancelTapTimer?.();
            cancelTapTimer = null;
            tapCount = 0;
            onGesture({ kind: 'longPress' });
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

    cancel() {
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
      return ['answer', 'next', 'acceptStretch'];
    case 'multiFingerTap':
      return g.fingers === 2 ? ['help'] : ['levelSelect'];
  }
}

export function actionForGesture(g: Gesture, valid: readonly Action[]): Action | null {
  return candidatesFor(g).find((a) => valid.includes(a)) ?? null;
}

/** Highest tap count that has a valid action, so a lone Click can fire without the multi-tap wait. */
export function maxTapsFor(valid: readonly Action[]): number {
  if (valid.includes('contrast')) return 3;
  if (valid.includes('replay')) return 2;
  return 1;
}

/** Attaches touch handling to the practice container; returns a detach function. */
export function attachGestures(
  el: HTMLElement,
  onAction: (a: Action) => boolean,
  getValid: () => readonly Action[],
  onTick: () => void,
): () => void {
  const rec = createRecognizer({
    maxTaps: () => maxTapsFor(getValid()),
    onGesture: (g) => {
      const action = actionForGesture(g, getValid());
      if (action && onAction(action)) onTick();
    },
  });
  const isButton = (e: PointerEvent) => e.target instanceof Element && e.target.closest('button, select, input, a') !== null;
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || isButton(e)) return; // mouse and real controls keep their own behaviour
    rec.down(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  };
  const move = (e: PointerEvent) => rec.move(e.pointerId, e.clientX, e.clientY);
  const up = (e: PointerEvent) => rec.up(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  const cancel = () => rec.cancel();
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    rec.cancel();
  };
}

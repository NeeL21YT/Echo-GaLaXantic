import { describe, expect, it } from 'vitest';
import { GESTURE } from '../src/config';
import { actionForGesture, createRecognizer, maxTapsFor, type Gesture } from '../src/input/gestures';

/** Manual clock: timers fire only when the test advances time. */
function harness(maxTaps = 3) {
  const got: Gesture[] = [];
  let now = 0;
  let timers: { at: number; fn: () => void; live: boolean }[] = [];
  const schedule = (fn: () => void, ms: number) => {
    const t = { at: now + ms, fn, live: true };
    timers.push(t);
    return () => {
      t.live = false;
    };
  };
  const advance = (ms: number) => {
    now += ms;
    const due = timers.filter((t) => t.live && t.at <= now).sort((a, b) => a.at - b.at);
    timers = timers.filter((t) => !due.includes(t));
    due.forEach((t) => t.fn());
  };
  const rec = createRecognizer({ onGesture: (g) => got.push(g), maxTaps: () => maxTaps, schedule });
  const tap = (id = 1, x = 100, y = 100, holdMs = 60) => {
    rec.down(id, x, y, now);
    advance(holdMs);
    rec.up(id, x, y, now);
  };
  return { rec, got, advance, tap, now: () => now };
}

describe('taps', () => {
  it('counts a double tap and waits for the window', () => {
    const h = harness();
    h.tap();
    h.advance(100);
    h.tap();
    expect(h.got).toEqual([]);
    h.advance(GESTURE.tapWindowMs + 1);
    expect(h.got).toEqual([{ kind: 'tap', count: 2 }]);
  });

  it('fires a lone tap at once when no multi-tap action is valid', () => {
    const h = harness(1);
    h.tap();
    expect(h.got).toEqual([{ kind: 'tap', count: 1 }]);
  });

  it('fires the third tap without waiting', () => {
    const h = harness(3);
    h.tap();
    h.advance(80);
    h.tap();
    h.advance(80);
    h.tap();
    expect(h.got).toEqual([{ kind: 'tap', count: 3 }]);
  });

  it('treats a slow touch as neither a tap nor a swipe', () => {
    const h = harness();
    h.tap(1, 100, 100, GESTURE.tapMaxMs + 100);
    h.advance(GESTURE.tapWindowMs * 2);
    expect(h.got.filter((g) => g.kind === 'tap')).toEqual([]);
  });
});

describe('swipes', () => {
  it.each([
    [-120, 0, 'left'],
    [120, 0, 'right'],
    [0, -120, 'up'],
    [0, 120, 'down'],
  ] as const)('dx %i dy %i is %s', (dx, dy, dir) => {
    const h = harness();
    h.rec.down(1, 200, 200, h.now());
    h.rec.move(1, 200 + dx, 200 + dy);
    h.advance(150);
    h.rec.up(1, 200 + dx, 200 + dy, h.now());
    expect(h.got).toEqual([{ kind: 'swipe', dir }]);
  });

  it('ignores a short wobble', () => {
    const h = harness(1);
    h.rec.down(1, 200, 200, h.now());
    h.advance(80);
    h.rec.up(1, 200 + GESTURE.swipeMinPx - 10, 200, h.now());
    expect(h.got.some((g) => g.kind === 'swipe')).toBe(false);
  });
});

describe('long press and multi-finger', () => {
  it('fires a long press once while held', () => {
    const h = harness();
    h.rec.down(1, 100, 100, h.now());
    h.advance(GESTURE.longPressMs + 10);
    h.rec.up(1, 100, 100, h.now());
    expect(h.got).toEqual([{ kind: 'longPress' }]);
  });

  it('recognises a two-finger tap', () => {
    const h = harness();
    h.rec.down(1, 100, 100, h.now());
    h.rec.down(2, 200, 100, h.now());
    h.advance(60);
    h.rec.up(1, 100, 100, h.now());
    h.rec.up(2, 200, 100, h.now());
    expect(h.got).toEqual([{ kind: 'multiFingerTap', fingers: 2 }]);
  });
});

describe('mapping', () => {
  it('uses the first valid candidate', () => {
    const swipeLeft: Gesture = { kind: 'swipe', dir: 'left' };
    expect(actionForGesture(swipeLeft, ['click', 'left', 'right'])).toBe('left');
    expect(actionForGesture(swipeLeft, ['click', 'turnLeft', 'turnRight'])).toBe('turnLeft');
    expect(actionForGesture(swipeLeft, ['click'])).toBeNull();
  });

  it('maps up to far or forward, down to near or back', () => {
    expect(actionForGesture({ kind: 'swipe', dir: 'up' }, ['far', 'near'])).toBe('far');
    expect(actionForGesture({ kind: 'swipe', dir: 'down' }, ['stepForward', 'stepBack'])).toBe('stepBack');
  });

  it('long press answers, or moves on in feedback', () => {
    expect(actionForGesture({ kind: 'longPress' }, ['answer'])).toBe('answer');
    expect(actionForGesture({ kind: 'longPress' }, ['replay', 'next'])).toBe('next');
  });

  it('only waits for taps that could mean something', () => {
    expect(maxTapsFor(['click', 'left'])).toBe(1);
    expect(maxTapsFor(['replay', 'next'])).toBe(2);
    expect(maxTapsFor(['replay', 'contrast', 'next'])).toBe(3);
  });
});

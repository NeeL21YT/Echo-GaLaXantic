import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  spoken: [] as string[],
  micGranted: true,
  openRanger: vi.fn(async () => undefined),
  closeRanger: vi.fn(),
  measure: vi.fn(),
  startCoach: vi.fn(async () => undefined),
  stopCoach: vi.fn(),
}));

vi.mock('../src/speech/narrator', () => ({
  speak: vi.fn(async (t: string) => { h.spoken.push(t); }),
  cancel: vi.fn(),
  awaitIdle: vi.fn(async () => undefined),
  isSpeaking: () => false,
  initNarrator: vi.fn(),
  nativeSpeechTimeoutMs: () => 1000,
}));
vi.mock('../src/native/echoNative', () => ({
  requestMicPermission: vi.fn(async () => h.micGranted),
  micPermissionGranted: vi.fn(async () => h.micGranted),
  isNative: () => false,
  vibrate: vi.fn(async () => true),
}));
vi.mock('../src/audio/ranger', () => ({
  openRanger: h.openRanger, closeRanger: h.closeRanger, measureNearestSurface: h.measure,
}));
vi.mock('../src/audio/clickCoach', () => ({ startClickCoach: h.startCoach, stopClickCoach: h.stopCoach }));
vi.mock('../src/audio/player', () => ({ play: vi.fn(async () => undefined), stopAll: vi.fn(), isPlaying: () => false, setVolume: vi.fn() }));
vi.mock('../src/audio/sfx', () => ({
  correct: vi.fn(async () => undefined), wrong: vi.fn(), bump: vi.fn(), levelUp: vi.fn(), footstep: vi.fn(), lrTest: vi.fn(),
}));
vi.mock('../src/audio/stimulus', () => ({ renderStimulus: vi.fn(async () => ({})) }));
vi.mock('../src/audio/micDetector', () => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('../src/audio/morsePlayer', () => ({ playMorse: vi.fn(), cancelMorse: vi.fn() }));

import { abortTeaching, lessonAction, lessonActions, startLesson } from '../src/state/lessonRunner';
import { roomAction, startRoom } from '../src/state/roomRunner';
import { useEcho } from '../src/state/store';

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  h.spoken.length = 0;
  h.micGranted = true;
  vi.clearAllMocks();
  useEcho.getState().patch({ phase: 'levelSelect', lessonId: null, lessonPage: 0 });
  useEcho.getState().setSettings({ narration: 'voice', clickSource: 'key' });
});

describe('lesson flow', () => {
  it('opens with its title and ends every page with what to press next', async () => {
    startLesson(2);
    await vi.waitFor(() => expect(h.spoken.at(-1)).toMatch(/^Page one of three\. /), { timeout: 6000 });
    expect(h.spoken[0]).toBe('Lesson two. Which side is the wall.');
  });

  it('opens the coach microphone for the lesson even when the click source is the key', async () => {
    startLesson(1);
    lessonAction('next');
    lessonAction('next');
    await tick(400);
    expect(h.startCoach).toHaveBeenCalled();
    expect(h.spoken.some((t) => t === 'I am listening. Click your tongue.')).toBe(true);
  });

  it('stops the coach microphone when the learner leaves mid-coach', async () => {
    useEcho.getState().setSettings({ clickSource: 'mic' });
    startLesson(1);
    lessonAction('next');
    lessonAction('next');
    await tick(400);
    expect(h.startCoach).toHaveBeenCalled();
    lessonAction('levelSelect');
    expect(h.stopCoach).toHaveBeenCalled();
    expect(useEcho.getState().lessonId).toBeNull();
  });

  it('adds only the way forward when the microphone is refused', async () => {
    h.micGranted = false;
    useEcho.getState().setSettings({ clickSource: 'mic' });
    startLesson(1);
    lessonAction('next');
    lessonAction('next');
    await tick(400);
    expect(h.startCoach).not.toHaveBeenCalled();
    expect(h.spoken.filter((t) => /microphone/i.test(t)).length).toBe(2);
    expect(h.spoken.some((t) => /^The microphone is off.*Practise ten slow clicks/.test(t))).toBe(true);
  });

  it('opens the matching level from the last page', async () => {
    startLesson(2);
    lessonAction('next');
    lessonAction('next');
    expect(lessonAction('answer')).toBe(true);
    await tick(50);
    expect(useEcho.getState().levelId).toBe(1);
    expect(useEcho.getState().lessonId).toBeNull();
  });

  it('abortTeaching releases the coach (Redo setup)', () => {
    startLesson(1);
    abortTeaching();
    expect(h.stopCoach).toHaveBeenCalled();
    expect(useEcho.getState().lessonId).toBeNull();
  });
});

describe('real room flow', () => {
  it('introduces itself in short messages, then pings, guesses and reveals', async () => {
    h.measure.mockResolvedValue({ distanceM: 1.8 });
    startRoom();
    await tick(50);
    expect(h.spoken.length).toBeGreaterThanOrEqual(3);
    roomAction('click');
    await tick(100);
    expect(h.spoken.some((t) => t.startsWith('Got it. Your guess is one metre.'))).toBe(true);
    roomAction('far');
    roomAction('answer');
    await tick(20);
    expect(h.spoken.at(-1)).toContain('one point eight metres');
  });

  it('says it could not find a wall and stays usable', async () => {
    h.measure.mockResolvedValue(null);
    startRoom();
    roomAction('click');
    await tick(100);
    expect(h.spoken.at(-1)).toMatch(/could not find a wall/);
    expect(roomAction('click')).toBe(true);
  });

  it('releases the microphone on Back, including mid-ping', async () => {
    h.measure.mockImplementation(() => new Promise(() => undefined));
    startRoom();
    roomAction('click');
    await tick(60);
    roomAction('levelSelect');
    expect(h.closeRanger).toHaveBeenCalled();
    expect(useEcho.getState().phase).toBe('levelSelect');
  });
});

describe('lesson 6', () => {
  it('opens the real room check from its last page', async () => {
    startLesson(6);
    await tick(50);
    useEcho.getState().patch({ lessonPage: 99 });
    expect(lessonActions()).toContain('answer');
    expect(lessonAction('answer')).toBe(true);
    await tick(50);
    expect(useEcho.getState().phase).toBe('realRoom');
  });
});

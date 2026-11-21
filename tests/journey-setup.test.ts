import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  spoken: [] as string[],
  micGranted: true,
  openRanger: vi.fn(async () => undefined),
  closeRanger: vi.fn(),
  measure: vi.fn(),
  startCoach: vi.fn(async () => undefined),
  stopCoach: vi.fn(),
  heading: null as number | null,
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
  audioFiltered: () => false, takeWasRough: () => false,
}));
vi.mock('../src/audio/clickCoach', () => ({ startClickCoach: h.startCoach, stopClickCoach: h.stopCoach }));
vi.mock('../src/input/compass', () => ({
  startCompass: vi.fn(),
  stopCompass: vi.fn(),
  currentHeading: () => h.heading,
  absoluteSupported: () => true,
}));
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
  h.heading = null;
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

const spoke = (text: string) =>
  vi.waitFor(() => expect(h.spoken.at(-1)).toContain(text), { timeout: 4000 });

describe('places', () => {
  it('keeps a spot, marks what is there, and recognises it on return', async () => {
    h.measure.mockResolvedValue({ distanceM: 1.8 });
    startRoom();
    h.heading = 0;
    roomAction('click');
    await spoke('Your guess is one metre.');
    h.heading = 90;
    roomAction('click');
    await spoke('Your guess is one metre.');

    await tick(30); // the ping's own guard is released once its speech has started
    roomAction('savePlace');
    await spoke('Saved as Place one.');

    roomAction('mark');
    await spoke('What is here?');
    roomAction('markDoorway');
    await spoke('A doorway or opening marked, about ninety degrees to your right, one point eight metres.');

    roomAction('answer');
    await spoke('The wall was one point eight metres away.');
    roomAction('replay');
    await spoke('Here you marked a doorway or opening, about ninety degrees to your right, one point eight metres.');

    // Walk away and come back to the same spot: two pings are enough to recognise it.
    roomAction('next');
    h.heading = 0;
    roomAction('click');
    await spoke('Your guess is one metre.');
    h.heading = 90;
    roomAction('click');
    await spoke('This looks like Place one.');
  });

  it('needs two facings before a place can be kept', async () => {
    h.measure.mockResolvedValue({ distanceM: 2 });
    startRoom();
    h.heading = 0;
    roomAction('click');
    await spoke('Your guess is one metre.');
    await tick(30);
    roomAction('savePlace');
    await spoke('ping once more');
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

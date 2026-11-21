// Drives the runner through whole runs of every level, the way a blind learner would, with audio, speech and the
// phone's native layer replaced by recorders.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const log: string[] = [];
const spoken: string[] = [];

vi.mock('../src/audio/micDetector', () => ({ start: vi.fn(async () => undefined), stop: vi.fn() }));
vi.mock('../src/audio/morsePlayer', () => ({
  playMorse: vi.fn(async (text: string) => { log.push(`morse:${text}`); }),
  cancelMorse: vi.fn(),
}));
vi.mock('../src/audio/player', () => ({
  play: vi.fn(async () => { log.push('play'); }),
  stopAll: vi.fn(),
}));
vi.mock('../src/audio/sfx', () => ({
  bump: vi.fn(async () => { log.push('sfx:bump'); }),
  correct: vi.fn(async () => { log.push('sfx:correct'); }),
  wrong: vi.fn(async () => { log.push('sfx:wrong'); }),
  levelUp: vi.fn(async () => { log.push('sfx:levelUp'); }),
  footstep: vi.fn(async () => undefined),
  turnTick: vi.fn(async () => undefined),
}));
vi.mock('../src/audio/stimulus', () => ({
  renderStimulus: vi.fn(async (_voices: unknown, opts: { includeDirect: boolean }) => {
    log.push(`render:${opts.includeDirect ? 'direct' : 'nodirect'}`);
    return { id: log.length } as unknown as AudioBuffer;
  }),
}));
vi.mock('../src/speech/narrator', () => ({
  speak: vi.fn(async (text: string) => { spoken.push(text); }),
  cancel: vi.fn(() => { log.push('cancel'); }),
  awaitIdle: vi.fn(async () => undefined),
}));
vi.mock('../src/native/echoNative', () => ({
  requestMicPermission: vi.fn(async () => true),
  vibrate: vi.fn(async () => undefined),
}));

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
});

import { LEVEL } from '../src/config';
import { getRuns, getTrials } from '../src/state/progress';
import { abortRun, dispatch, goToLevelSelect, setClickSource, startLevel, validActions } from '../src/state/runner';
import { useEcho, type LevelId } from '../src/state/store';
import { start as startMic } from '../src/audio/micDetector';

const S = () => useEcho.getState();
const settle = () => new Promise<void>((r) => setTimeout(r, 0));
async function press(action: Parameters<typeof dispatch>[0]): Promise<boolean> {
  const applied = dispatch(action);
  await settle();
  return applied;
}
const last = () => spoken[spoken.length - 1] ?? '';

beforeEach(() => {
  abortRun();
  storage.clear();
  log.length = 0;
  spoken.length = 0;
  S().patch({ phase: 'levelSelect', levelId: null, trial: null, stretchOffer: null, collisions: 0, settingsOpen: false, micOn: false });
  S().setSettings({ stretch: 4, narration: 'voice', clickSource: 'key', morse: 'off', haptics: false });
});

async function begin(id: LevelId): Promise<void> {
  await startLevel(id);
  expect(S().phase).toBe('intro');
  await press('answer');
  expect(S().phase).toBe('ready');
}

/** Plays one choice trial: click once, then answer rightly or wrongly. */
async function choiceTrial(right: boolean): Promise<void> {
  const trial = S().trial!;
  await press('click');
  expect(S().clicksThisTrial).toBe(1);
  const opposite: Record<string, string> = { left: 'right', right: 'left', near: 'far', far: 'near' };
  const value = right ? String(trial.answer) : opposite[String(trial.answer)]!;
  await press(value as 'left' | 'right' | 'near' | 'far');
  expect(S().phase).toBe('feedback');
  expect(S().lastResult?.correct).toBe(right);
}

async function choiceRun(id: 1 | 2, rights: number): Promise<void> {
  await begin(id);
  const total = S().trialCount;
  for (let i = 0; i < total; i++) {
    expect(S().trialIndex).toBe(i);
    await choiceTrial(i < rights);
    await press('next');
  }
}

describe('level 1 and 2 journeys', () => {
  it('level 1: a passing run logs every trial and speaks the score and the way on', async () => {
    await choiceRun(1, 8);
    expect(S().phase).toBe('summary');
    expect(last()).toContain('Level one. Eight out of ten.');
    expect(last()).toContain('Passed.');
    expect(last()).toContain('Press Enter for the level list.');
    expect(getTrials().filter((t) => t.levelId === 1)).toHaveLength(10);
    expect(getRuns()).toHaveLength(1);
    expect(log).toContain('sfx:levelUp');
    await press('next');
    expect(S().phase).toBe('levelSelect');
  });

  it('level 1: a failing run says Not yet and plays no level-up jingle', async () => {
    await choiceRun(1, 7);
    expect(last()).toContain('Seven out of ten. Not yet. You can try again.');
    expect(log).not.toContain('sfx:levelUp');
  });

  it('level 2: wrong and right feedback name the cue to listen for', async () => {
    await begin(2);
    await choiceTrial(false);
    expect(last()).toMatch(/^Not quite\. The wall was (near|far)/);
    expect(last()).toMatch(/sooner|later/);
    expect(last()).toContain('Press R to replay, C for contrast, or N for next.');
  });

  it('answering before any click is refused with the click instruction and logs nothing', async () => {
    await begin(1);
    await press('left');
    expect(S().phase).toBe('ready');
    expect(last()).toBe('Click first. Press Space to hear the room.');
    expect(getTrials()).toHaveLength(0);
  });

  it('a second answer or Next mid-feedback cannot double-log or skip a trial', async () => {
    await begin(1);
    await press('click');
    const answer = String(S().trial!.answer) as 'left' | 'right';
    dispatch(answer);
    dispatch(answer);
    dispatch('left');
    await settle();
    expect(S().results).toHaveLength(1);
    dispatch('next');
    dispatch('next');
    await settle();
    expect(S().trialIndex).toBe(1);
    expect(S().phase).toBe('ready');
    expect(getTrials()).toHaveLength(1);
  });

  it('rapid clicks keep one stimulus and count one click while the first render is stale', async () => {
    await begin(1);
    dispatch('click');
    dispatch('click');
    dispatch('click');
    await settle();
    expect(S().clicksThisTrial).toBe(1);
    expect(log.filter((e) => e === 'play')).toHaveLength(1);
  });

  it('an answer that arrives while the first click is still rendering is not scolded', async () => {
    await begin(1);
    dispatch('click');
    dispatch('left');
    await settle();
    expect(spoken.some((t) => t.startsWith('Click first'))).toBe(false);
    expect(S().phase).toBe('ready');
  });

  it('cancels speech before the stimulus plays', async () => {
    await begin(1);
    log.length = 0;
    await press('click');
    expect(log.indexOf('cancel')).toBeGreaterThanOrEqual(0);
    expect(log.indexOf('cancel')).toBeLessThan(log.indexOf('play'));
  });

  it('replay before a click asks for a click, and after feedback replays the last sound', async () => {
    await begin(1);
    await press('replay');
    expect(last()).toContain('Click first');
    await choiceTrial(true);
    log.length = 0;
    await press('replay');
    expect(log).toContain('play');
    await press('next');
    expect(getTrials()[0]?.replays).toBe(1);
  });

  it('contrast renders from the answered pose, labels both sounds and counts once', async () => {
    await begin(1);
    await choiceTrial(true);
    spoken.length = 0;
    log.length = 0;
    await press('contrast');
    await new Promise((r) => setTimeout(r, 600));
    expect(spoken).toEqual(['Without', 'With']);
    expect(log.filter((e) => e === 'play')).toHaveLength(2);
    await press('next');
    expect(getTrials()[0]?.contrasts).toBe(1);
  });

  it('level 2 contrast says Near then Far', async () => {
    await begin(2);
    await choiceTrial(true);
    spoken.length = 0;
    await press('contrast');
    await new Promise((r) => setTimeout(r, 600));
    expect(spoken).toEqual(['Near', 'Far']);
  });

  it('three passing runs offer faster echoes; Yes accepts and says how to go on', async () => {
    for (let i = 0; i < 3; i++) {
      await choiceRun(1, 10);
      if (i < 2) await press('next');
    }
    expect(S().stretchOffer).not.toBeNull();
    expect(last()).toContain('Press Y for yes. Or press Enter for the level list.');
    const offer = S().stretchOffer!;
    await press('acceptStretch');
    expect(S().settings.stretch).toBe(offer);
    expect(S().stretchOffer).toBeNull();
    expect(last()).toContain('Echo speed is now');
    expect(last()).toContain('level list');
  });

  it('declining the offer by pressing Next keeps the speed and leaves the list', async () => {
    for (let i = 0; i < 3; i++) {
      await choiceRun(1, 10);
      if (i < 2) await press('next');
    }
    await press('next');
    expect(S().phase).toBe('levelSelect');
    expect(S().stretchOffer).toBeNull();
    expect(S().settings.stretch).toBe(4);
  });

  it('the second summary mentions the previous score', async () => {
    await choiceRun(1, 8);
    await press('next');
    await choiceRun(1, 9);
    expect(last()).toContain('Previously eight out of ten.');
  });
});

describe('level 3 journey', () => {
  it('turning in 15 degree steps and answering when facing the door passes', async () => {
    await begin(3);
    for (let i = 0; i < LEVEL.l3.trials; i++) {
      const trial = S().trial!;
      await press('click');
      const before = S().pose.headingDeg;
      await press('turnRight');
      expect((S().pose.headingDeg - before + 360) % 360).toBeCloseTo(15, 5);
      await press('turnLeft');
      S().patch({ pose: { ...S().pose, headingDeg: Number(trial.answer) } });
      await press('answer');
      expect(S().lastResult?.correct).toBe(true);
      await press('next');
    }
    expect(S().phase).toBe('summary');
    expect(last()).toContain('Five out of five. Passed.');
  });

  it('a wrong heading is told which way the door was', async () => {
    await begin(3);
    const trial = S().trial!;
    await press('click');
    S().patch({ pose: { ...S().pose, headingDeg: Number(trial.answer) + 90 } });
    await press('answer');
    expect(S().lastResult?.correct).toBe(false);
    expect(last()).toMatch(/The door was .* Listen for the side where the room goes quiet\./);
  });

  it('Enter before a click says to click first', async () => {
    await begin(3);
    await press('answer');
    expect(S().phase).toBe('ready');
    expect(last()).toContain('Click first');
  });
});

describe('level 4 journey', () => {
  it('a bump says Bump., keeps the run going, and counts against that trial only', async () => {
    await begin(4);
    await press('stepBack');
    expect(S().phase).toBe('ready');
    expect(S().collisions).toBe(1);
    expect(last()).toMatch(/^Bump. One. .*Turn and keep going.$/);
    S().patch({ pose: { p: { x: 0, y: 9.5 }, headingDeg: 0 } });
    await press('stepForward');
    expect(S().phase).toBe('feedback');
    expect(S().lastResult?.correct).toBe(false);
    expect(last()).toContain('one bump');
    await press('next');
    expect(S().collisions).toBe(0);
    expect(getTrials()[0]?.collisions).toBe(1);
  });

  it('two clean runs out of three pass the level', async () => {
    await begin(4);
    for (let i = 0; i < 3; i++) {
      if (i === 0) {
        await press('stepBack');
      }
      S().patch({ pose: { p: { x: 0, y: 9.5 }, headingDeg: 0 } });
      await press('stepForward');
      expect(S().phase).toBe('feedback');
      await press('next');
    }
    expect(S().phase).toBe('summary');
    expect(last()).toContain('Two out of three. Passed.');
  });

  it('only one clean run does not pass', async () => {
    await begin(4);
    for (let i = 0; i < 3; i++) {
      if (i < 2) await press('stepBack');
      S().patch({ pose: { p: { x: 0, y: 9.5 }, headingDeg: 0 } });
      await press('stepForward');
      await press('next');
    }
    expect(last()).toContain('One out of three. Not yet.');
  });

  it('exiting without a click makes Replay say so instead of staying silent', async () => {
    await begin(4);
    S().patch({ pose: { p: { x: 0, y: 9.5 }, headingDeg: 0 } });
    await press('stepForward');
    await press('replay');
    expect(last()).toBe('There was no click to replay.');
  });

  it('a long run of steps never tunnels through the side walls', async () => {
    await begin(4);
    S().patch({ pose: { p: { x: 0, y: 5 }, headingDeg: 90 } });
    for (let i = 0; i < 6; i++) await press('stepForward');
    expect(Math.abs(S().pose.p.x)).toBeLessThan(1);
    expect(S().collisions).toBeGreaterThan(0);
  });
});

describe('level 5 journey', () => {
  const nearExit = { p: { x: 6.6, y: 7 }, headingDeg: 90 };

  it('exiting in time passes and bumps are not scored', async () => {
    await begin(5);
    await press('stepBack');
    expect(S().collisions).toBe(1);
    S().patch({ pose: nearExit });
    await press('stepForward');
    expect(S().phase).toBe('feedback');
    expect(S().lastResult?.correct).toBe(true);
    expect(last()).toContain('You escaped in');
    await press('next');
    expect(S().phase).toBe('summary');
    expect(last()).toContain('One out of one. Passed.');
  });

  it('exiting after the time limit is Not yet', async () => {
    await begin(5);
    await press('turnRight');
    S().patch({ startedAt: performance.now() / 1000 - (LEVEL.l5.timeLimitS + 5), pose: nearExit });
    await press('stepForward');
    expect(S().lastResult?.correct).toBe(false);
    expect(last()).toContain('Try to get out in under ninety seconds.');
    await press('next');
    expect(last()).toContain('Not yet.');
  });

  it('offers no Contrast after the escape', async () => {
    await begin(5);
    S().patch({ pose: nearExit });
    await press('stepForward');
    expect(validActions()).not.toContain('contrast');
  });
});

describe('interruptions', () => {
  it('Back mid-trial and mid-feedback return to the list and log only finished trials', async () => {
    await begin(1);
    await press('click');
    await goToLevelSelect();
    expect(S().phase).toBe('levelSelect');
    expect(getTrials()).toHaveLength(0);
    await begin(1);
    await choiceTrial(true);
    await goToLevelSelect();
    expect(getTrials()).toHaveLength(1);
  });

  it('Back while a click is rendering discards the stale stimulus', async () => {
    await begin(1);
    dispatch('click');
    await goToLevelSelect();
    await settle();
    expect(log.filter((e) => e === 'play')).toHaveLength(0);
    expect(S().phase).toBe('levelSelect');
  });

  it('abortRun discards the unwritten log and in-flight work', async () => {
    await begin(1);
    await choiceTrial(true);
    abortRun();
    S().patch({ phase: 'levelSelect' });
    await press('next');
    expect(getTrials()).toHaveLength(0);
  });

  it('moving cancels a click that is still rendering', async () => {
    await begin(4);
    dispatch('click');
    dispatch('turnRight');
    await settle();
    expect(S().clicksThisTrial).toBe(0);
    expect(log.filter((e) => e === 'play')).toHaveLength(0);
  });

  it('going to the background and coming back repeats where you are', async () => {
    await begin(1);
    await choiceTrial(true);
    const { pauseForBackground, resumeFromBackground } = await import('../src/state/runner');
    pauseForBackground();
    spoken.length = 0;
    resumeFromBackground();
    await settle();
    expect(spoken[0]).toContain('Correct');
  });
});

describe('mic click source', () => {
  it('in mic mode the Click button and Space render with the direct click', async () => {
    S().setSettings({ clickSource: 'mic' });
    await begin(1);
    log.length = 0;
    await press('click');
    expect(log).toContain('render:direct');
    expect(S().clicksThisTrial).toBe(1);
  });

  it('a click heard by the microphone renders without the direct click', async () => {
    await setClickSource('mic');
    const onClick = vi.mocked(startMic).mock.calls.at(-1)![0];
    await begin(1);
    log.length = 0;
    onClick();
    await settle();
    expect(log).toContain('render:nodirect');
  });

  it('key mode renders with the direct click', async () => {
    await begin(1);
    await press('click');
    expect(log).toContain('render:direct');
  });

  it('the ready hint offers a tongue click in mic mode', async () => {
    S().setSettings({ clickSource: 'mic' });
    await startLevel(1);
    expect(last()).toContain('Make a tongue click, or press Space to click.');
  });

  it('falls back to the Space key, and says so, when the microphone cannot start', async () => {
    vi.mocked(startMic).mockRejectedValueOnce(new Error('denied'));
    const source = await setClickSource('mic');
    expect(source).toBe('key');
    expect(S().settings.clickSource).toBe('key');
    expect(last()).toBe('Microphone blocked. Press Space to click.');
  });

  it('mic clicks are ignored while Settings is open', async () => {
    await setClickSource('mic');
    const onClick = vi.mocked(startMic).mock.calls[0]![0];
    await begin(1);
    S().patch({ settingsOpen: true });
    onClick();
    await settle();
    expect(S().clicksThisTrial).toBe(0);
    S().patch({ settingsOpen: false });
    onClick();
    await settle();
    expect(S().clicksThisTrial).toBe(1);
  });
});

describe('Morse and narration', () => {
  it('Morse fires once per result, after the speech starts', async () => {
    S().setSettings({ morse: 'sound' });
    await begin(1);
    await choiceTrial(true);
    expect(log.filter((e) => e === 'morse:OK')).toHaveLength(1);
    expect(log.filter((e) => e.startsWith('morse:')).length).toBeGreaterThanOrEqual(2);
  });

  it('screen-reader mode announces instead of speaking', async () => {
    S().setSettings({ narration: 'screenreader' });
    await begin(1);
    expect(spoken).toHaveLength(0);
    expect(S().announcement.text).toContain('Trial one of ten');
  });

  it('valid actions in feedback follow the level', async () => {
    await begin(1);
    await choiceTrial(true);
    expect(validActions()).toEqual(['replay', 'contrast', 'next', 'help', 'observer', 'levelSelect']);
  });
});

describe('next step after every trial', () => {
  it('a later trial still ends its feedback with how to go on', async () => {
    await begin(1);
    await choiceTrial(true);
    await press('next');
    await choiceTrial(true);
    expect(last()).toMatch(/Press N for next\.$/);
  });
  it('the offer names the speed it would replace', async () => {
    for (let i = 0; i < 3; i++) {
      await choiceRun(1, 10);
      if (i < 2) await press('next');
    }
    expect(last()).toMatch(/Try echoes .* times slower instead of four\? Press Y for yes\./);
  });
});

describe('mic loss', () => {
  it('a microphone that stops mid-run falls back to the click instruction', async () => {
    await setClickSource('mic');
    const onEnded = vi.mocked(startMic).mock.calls.at(-1)![1]!;
    onEnded();
    expect(S().settings.clickSource).toBe('key');
    expect(S().micOn).toBe(false);
    expect(last()).toBe('The microphone stopped. Press Space to click.');
  });
  it('a start cancelled on purpose is silent and does not claim the mic is blocked', async () => {
    vi.mocked(startMic).mockRejectedValueOnce(new Error('microphone start cancelled'));
    spoken.length = 0;
    await setClickSource('mic');
    expect(spoken).toHaveLength(0);
  });
});

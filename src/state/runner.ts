// Phase machine (§8.1): onboarding → levelSelect → intro → ready ⇄ clicking/moving → feedback → next | summary.
// Every async step (render, speech, contrast) carries a job id; anything that changes phase bumps it so stale
// work started before Esc/Next can never play or overwrite state.
import { CONTRAST_PAUSE_MS, MORSE, NARRATION, RENDER_VERSION, STEP_M, TURN_DEG } from '../config';
import { start as startMic, stop as stopMic } from '../audio/micDetector';
import { playMorse } from '../audio/morsePlayer';
import { feel, feelAnswer } from './haptics';
import { play, stopAll } from '../audio/player';
import { bump, correct, footstep, levelUp, wrong } from '../audio/sfx';
import { renderStimulus } from '../audio/stimulus';
import { move, reachedExit, turn } from '../engine/collision';
import { buildEchoes } from '../engine/echoBuilder';
import { castRays } from '../engine/raycaster';
import { mulberry32 } from '../engine/rng';
import { phrases } from '../input/inputStyle';
import { ACTION_KEY } from '../input/keyboard';
import { getLevel } from '../levels';
import type { AnswerResult, LevelDef, Trial } from '../levels/types';
import { awaitIdle, cancel, speak } from '../speech/narrator';
import type { Pose, World } from '../types';
import { LEVEL_LIST_HEADING, levelSelectPrompt } from '../ui/labels';
import { logRun, logTrial, levelStats, suggestedStretch, type TrialLogEntry } from './progress';
import { useEcho, type Action, type ClickSource, type LevelId } from './store';

const S = () => useEcho.getState();

let jobId = 0;
let runSeed = 0;
let runStartedAt = 0;
let pendingLog: TrialLogEntry | null = null;

const newJob = () => ++jobId;
const isCurrent = (id: number) => id === jobId;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nowS = () => performance.now() / 1000;

function currentLevel(): LevelDef | null {
  const id = S().levelId;
  return id === null ? null : getLevel(id);
}

// ---------- narration routing ----------

/** Shows text in the blind view and sends it to exactly one narration channel (voice OR aria-live). */
export async function say(text: string, opts: { isError?: boolean; display?: string } = {}): Promise<void> {
  const st = S();
  // `display` is a shorter line for the screen when the spoken text is long (the level-list instructions).
  st.patch({ message: opts.display ?? text });
  if (st.settings.narration === 'voice') {
    cancel();
    if (opts.isError) announce(text, true);
    await speak(text);
  } else {
    announce(text, opts.isError ?? false);
  }
}

function announce(text: string, isError: boolean): void {
  const st = S();
  st.patch({ announcement: { text, id: st.announcement.id + 1, isError } });
}

/** Speaks a short label before a sound; in screen-reader mode leaves room for the reader to finish. */
export async function sayLabel(label: string): Promise<void> {
  if (S().settings.narration === 'voice') {
    await speak(label);
  } else {
    announce(label, false);
    await sleep(NARRATION.screenReaderLabelGapMs);
  }
}

export async function silenceSpeech(): Promise<void> {
  if (S().settings.narration === 'voice') {
    cancel();
    await awaitIdle();
  }
}

// ---------- rendering ----------

export async function renderFrom(world: World, pose: Pose, seed: number) {
  const st = S();
  const hits = castRays(world, pose);
  const voices = buildEchoes(hits, st.settings.stretch);
  const buffer = await renderStimulus(voices, { includeDirect: st.settings.clickSource === 'key', seed });
  return { hits, voices, buffer };
}

// ---------- level flow ----------

export async function goToLevelSelect(): Promise<void> {
  newJob();
  stopAll();
  finalizePendingLog();
  S().patch({ phase: 'levelSelect', levelId: null, trial: null, lastHits: [], lastPose: null, stretchOffer: null });
  await say(levelSelectPrompt(), { display: LEVEL_LIST_HEADING });
}

export async function startLevel(id: LevelId): Promise<void> {
  newJob();
  stopAll();
  const level = getLevel(id);
  runSeed = (Date.now() ^ (id << 16)) >>> 0;
  S().patch({
    phase: 'intro',
    levelId: id,
    runId: `${Date.now()}-${id}`,
    trialIndex: 0,
    trialCount: level.trials,
    trial: null,
    results: [],
    collisions: 0,
    lastResult: null,
    lastHits: [],
    lastPose: null,
    stretchOffer: null,
  });
  const title = /[.?!]$/.test(level.title) ? level.title : `${level.title}.`;
  void playMorse(String(id), S().settings.morse);
  await say(`Level ${id}. ${title} ${level.intro} ${readyHint(level)} ${phrases().begin}`);
}

function beginTrial(index: number): void {
  const level = currentLevel();
  if (!level) return;
  newJob();
  stopAll();
  const trial = level.makeTrial(mulberry32(runSeed), index);
  if (index === 0) runStartedAt = nowS();
  S().patch({
    phase: 'ready',
    trialIndex: index,
    trial,
    pose: trial.start,
    clicksThisTrial: 0,
    replays: 0,
    contrasts: 0,
    collisions: 0,
    startedAt: null,
    lastResult: null,
    lastHits: [],
    lastVoices: [],
    lastPose: null,
    lastStimulus: null,
  });
  void say(index === 0 ? `Trial 1 of ${level.trials}. ${readyHint(level)}` : `Trial ${index + 1} of ${level.trials}.`);
}

/** How to play the level, in the words of the way the learner is controlling Echo (keys, touch or buttons). */
function readyHint(level: LevelDef): string {
  const p = phrases();
  if (level.mode === 'choice') {
    const sides = Object.values(level.answerKeys).includes('left');
    return `${p.click} ${sides ? p.answerSide : p.answerDistance}`;
  }
  if (level.mode === 'aim') return `${p.turn} ${p.click} ${p.faceDoor}`;
  return `${p.walk} ${p.turn} ${p.click}`;
}

function markStarted(): void {
  const st = S();
  if (st.startedAt === null) st.patch({ startedAt: nowS() });
}

function trialElapsed(): number {
  const started = S().startedAt;
  return started === null ? 0 : nowS() - started;
}

export async function click(): Promise<void> {
  const st = S();
  if (st.phase !== 'ready' || !st.trial) return;
  const id = newJob();
  stopAll();
  markStarted();
  const { trial, pose } = st;
  await silenceSpeech();
  if (!isCurrent(id)) return;
  const { hits, voices, buffer } = await renderFrom(trial.world, pose, trial.seed);
  if (!isCurrent(id)) return;
  // Keyboard focus may have started a label while the offline render was pending.
  await silenceSpeech();
  if (!isCurrent(id)) return;
  const now = S();
  now.patch({
    lastHits: hits,
    lastVoices: voices,
    lastStimulus: buffer,
    lastPose: pose,
    shotId: now.shotId + 1,
    clicksThisTrial: now.clicksThisTrial + 1,
  });
  await play(buffer);
}

function answerValueFor(level: LevelDef, action: Action): string | null | undefined {
  if (level.mode === 'aim') return action === 'answer' ? null : undefined;
  const key = ACTION_KEY[action];
  return key !== undefined ? level.answerKeys[key] : undefined;
}

async function answer(action: Action): Promise<boolean> {
  const st = S();
  const level = currentLevel();
  if (st.phase !== 'ready' || !level || !st.trial || level.mode === 'navigate') return false;
  const value = answerValueFor(level, action);
  if (value === undefined) return false;
  if (st.clicksThisTrial < 1) {
    await say(phrases().clickFirst);
    return true;
  }
  feelAnswer(action);
  const result = level.check(st.trial, value, st.pose, trialElapsed());
  await finishTrial(result, value);
  return true;
}

async function finishTrial(result: AnswerResult, answerValue: string | number | null): Promise<void> {
  const id = newJob();
  stopAll();
  const st = S();
  if (!st.trial || st.levelId === null || st.runId === null) return;
  pendingLog = {
    ts: Date.now(),
    runId: st.runId,
    levelId: st.levelId,
    trialIndex: st.trialIndex,
    seed: st.trial.seed,
    stretch: st.settings.stretch,
    clickSource: st.settings.clickSource,
    renderVersion: RENDER_VERSION,
    answer: answerValue,
    correct: result.correct,
    replays: 0,
    contrasts: 0,
    collisions: st.collisions,
    elapsedS: trialElapsed(),
  };
  st.patch({ phase: 'feedback', results: [...st.results, result], lastResult: result });
  feel(result.correct ? 'pass' : 'miss');
  await silenceSpeech();
  await (result.correct ? correct() : wrong());
  void playMorse(result.correct ? MORSE.pass : MORSE.miss, st.settings.morse);
  if (!isCurrent(id)) return;
  const hint = st.trialIndex === 0 ? phrases().feedbackHint(Boolean(result.contrast)) : '';
  await say(result.explanation + hint);
}

/** Replay and contrast counts are only known once the player leaves feedback, so the log entry is written then. */
function finalizePendingLog(): void {
  if (!pendingLog) return;
  const st = S();
  logTrial({ ...pendingLog, replays: st.replays, contrasts: st.contrasts });
  pendingLog = null;
}

async function replay(): Promise<void> {
  const st = S();
  if (!st.lastStimulus || (st.phase !== 'feedback' && st.phase !== 'ready')) return;
  const id = newJob();
  stopAll();
  if (st.phase === 'feedback') st.patch({ replays: st.replays + 1 });
  await silenceSpeech();
  if (!isCurrent(id) || !st.lastStimulus) return;
  await play(st.lastStimulus);
}

async function contrast(): Promise<void> {
  const st = S();
  const items = st.lastResult?.contrast;
  if (st.phase !== 'feedback' || !items || items.length === 0 || !st.trial) return;
  const id = newJob();
  stopAll();
  st.patch({ contrasts: st.contrasts + 1 });
  const pose = st.lastPose ?? st.pose;
  const seed = st.trial.seed;
  await silenceSpeech();
  for (const [i, item] of items.entries()) {
    if (i > 0) await sleep(CONTRAST_PAUSE_MS);
    if (!isCurrent(id)) return;
    await sayLabel(item.label);
    if (!isCurrent(id)) return;
    const { buffer } = await renderFrom(item.world, pose, seed);
    if (!isCurrent(id)) return;
    await silenceSpeech();
    if (!isCurrent(id)) return;
    await play(buffer);
  }
}

async function next(): Promise<void> {
  const st = S();
  if (st.phase === 'summary') {
    await goToLevelSelect();
    return;
  }
  if (st.phase !== 'feedback') return;
  finalizePendingLog();
  const level = currentLevel();
  if (!level) return;
  // Navigation levels continue after a bump; only a finished run moves on.
  if (st.trialIndex + 1 < level.trials) beginTrial(st.trialIndex + 1);
  else await summary(level);
}

async function summary(level: LevelDef): Promise<void> {
  newJob();
  stopAll();
  const st = S();
  if (st.runId === null) return;
  const score = st.results.filter((r) => r.correct).length;
  const total = level.trials;
  const passed = level.passRule(st.results, nowS() - runStartedAt);
  const before = levelStats(level.id, st.settings.stretch);
  logRun({ ts: Date.now(), runId: st.runId, levelId: level.id, stretch: st.settings.stretch, score, total, passed });
  const prev = before.lastScore ? ` Previously ${before.lastScore.score} out of ${before.lastScore.total}.` : '';
  const offer = passed ? suggestedStretch(level.id, st.settings.stretch) : null;
  st.patch({ phase: 'summary', stretchOffer: offer });
  if (passed) await levelUp();
  let text = `Level ${level.id}. ${score} out of ${total}.${prev} ${passed ? 'Passed.' : 'Not yet.'}`;
  if (offer !== null) {
    text += ` You passed three times in a row. Try echoes closer to real speed, at ${offer} times? ${phrases().yes}`;
  }
  await say(`${text} ${phrases().levelList}`);
}

// ---------- movement (navigate levels; turning also used by aim) ----------

async function turnBy(deltaDeg: number): Promise<boolean> {
  const st = S();
  const level = currentLevel();
  if (st.phase !== 'ready' || !level || level.mode === 'choice') return false;
  markStarted();
  st.patch({ pose: turn(st.pose, deltaDeg) });
  return true;
}

async function stepBy(step: number): Promise<boolean> {
  const st = S();
  const level = currentLevel();
  if (st.phase !== 'ready' || !level || level.mode !== 'navigate' || !st.trial) return false;
  markStarted();
  const res = move(st.pose, step, st.trial.world);
  if (res.collided) {
    const collisions = st.collisions + 1;
    st.patch({ collisions });
    const withMeta: Trial = { ...st.trial, meta: { ...st.trial.meta, collisions } };
    const feedback = level.check(withMeta, 'bump', st.pose, trialElapsed());
    newJob();
    stopAll();
    feel('bump');
    await bump();
    void playMorse(MORSE.bump, S().settings.morse);
    await say(`Bump. ${collisions}. ${feedback.explanation}`.trim());
    return true;
  }
  st.patch({ pose: res.pose });
  void footstep();
  if (reachedExit(res.pose, st.trial.world)) {
    const withMeta: Trial = { ...st.trial, meta: { ...st.trial.meta, collisions: st.collisions } };
    await finishTrial(level.check(withMeta, 'exit', res.pose, trialElapsed()), 'exit');
  }
  return true;
}

// ---------- click source ----------

/** Switches between Space and tongue clicks. Falls back to Space if the mic is blocked. Returns the source in use. */
export async function setClickSource(source: ClickSource): Promise<ClickSource> {
  const st = S();
  if (source === 'key') {
    stopMic();
    st.setSettings({ clickSource: 'key' });
    st.patch({ micOn: false });
    return 'key';
  }
  try {
    await startMic(() => {
      const now = S();
      now.patch({ micClicks: now.micClicks + 1 });
      dispatch('click');
    });
    st.setSettings({ clickSource: 'mic' });
    st.patch({ micOn: true });
    return 'mic';
  } catch {
    stopMic();
    st.setSettings({ clickSource: 'key' });
    st.patch({ micOn: false });
    await say('Microphone blocked. Using the Space key.', { isError: true });
    return 'key';
  }
}

// ---------- help, stretch, dispatch ----------

async function help(): Promise<void> {
  if (S().phase === 'levelSelect') {
    await say(levelSelectPrompt(), { display: LEVEL_LIST_HEADING });
    return;
  }
  const level = currentLevel();
  const general = phrases().help;
  await say(level ? `${readyHint(level)} ${general}` : general);
}

async function acceptStretch(): Promise<boolean> {
  const st = S();
  if (st.stretchOffer === null) return false;
  st.setSettings({ stretch: st.stretchOffer });
  st.patch({ stretchOffer: null });
  await say(`Echo speed is now ${st.stretchOffer === 1 ? 'real speed' : `${st.stretchOffer} times slower`}.`);
  return true;
}

/** Routes a button press or shortcut. Returns true if the action applied in the current phase. */
export function dispatch(action: Action): boolean {
  const st = S();
  const run = (p: Promise<unknown>) => {
    p.catch((err: unknown) => {
      console.error(err);
      void say('Something went wrong. Press Escape for the level list.', { isError: true });
    });
    return true;
  };
  switch (action) {
    case 'click':
      return st.phase === 'ready' ? run(click()) : false;
    case 'answer':
      if (st.phase === 'intro') {
        beginTrial(0);
        return true;
      }
      if (st.phase === 'feedback' || st.phase === 'summary') return run(next());
      return run(answer(action));
    case 'left':
    case 'right':
    case 'near':
    case 'far':
      return run(answer(action));
    case 'turnLeft':
      return run(turnBy(-TURN_DEG));
    case 'turnRight':
      return run(turnBy(TURN_DEG));
    case 'stepForward':
      return run(stepBy(STEP_M));
    case 'stepBack':
      return run(stepBy(-STEP_M));
    case 'replay':
      return run(replay());
    case 'contrast':
      return run(contrast());
    case 'next':
      return st.phase === 'feedback' || st.phase === 'summary' ? run(next()) : false;
    case 'acceptStretch':
      return run(acceptStretch());
    case 'observer':
      st.setSettings({ observer: !st.settings.observer });
      return true;
    case 'help':
      return run(help());
    case 'levelSelect':
      return st.phase === 'onboarding' ? false : run(goToLevelSelect());
    case 'settings':
      return false;
  }
}

/** The actions that make sense right now; Controls shows exactly these as buttons. */
export function validActions(): Action[] {
  const st = S();
  const level = currentLevel();
  const common: Action[] = ['help', 'observer', 'levelSelect'];
  switch (st.phase) {
    case 'levelSelect':
      return ['help'];
    case 'intro':
      return ['answer', ...common];
    case 'ready': {
      if (!level) return common;
      if (level.mode === 'choice') {
        const answers = (['left', 'right', 'near', 'far'] as const).filter((a) => {
          const key = ACTION_KEY[a];
          return key !== undefined && key in level.answerKeys;
        });
        return ['click', ...answers, ...common];
      }
      if (level.mode === 'aim') return ['click', 'turnLeft', 'turnRight', 'answer', ...common];
      return ['click', 'turnLeft', 'turnRight', 'stepForward', 'stepBack', ...common];
    }
    case 'feedback':
      return ['replay', ...(st.lastResult?.contrast ? (['contrast'] as const) : []), 'next', ...common];
    case 'summary':
      return [...(st.stretchOffer !== null ? (['acceptStretch'] as const) : []), 'next', 'observer'];
    default:
      return [];
  }
}

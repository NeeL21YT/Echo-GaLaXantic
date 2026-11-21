// Zustand store (build_spec §8.2). Pure state + setters; flow logic lives in runner.ts.
import { create } from 'zustand';
import { DEFAULT_STRETCH } from '../config';
import { isOnboarded, loadSettings } from './progress';
import type { AnswerResult, LevelDef, Trial } from '../levels/types';
import type { EchoVoice, Hit, Pose } from '../types';

export type Phase = 'onboarding' | 'levelSelect' | 'lesson' | 'intro' | 'ready' | 'answered' | 'feedback' | 'summary';
export type Narration = 'voice' | 'screenreader';
export type ClickSource = 'key' | 'mic';
export type LevelId = LevelDef['id'];

export type Settings = {
  stretch: number;
  narration: Narration;
  clickSource: ClickSource;
  volume: number;
  observer: boolean;
  /** Extra feedback as Morse code, added to the narration (§13.4). */
  morse: 'off' | 'vibration' | 'sound';
  /** Native only: volume keys act as Click / Replay instead of changing the system volume (§13.3). */
  volumeKeys: boolean;
};

/** Every user action; buttons and keys both map onto these. */
export type Action =
  | 'click'
  | 'left'
  | 'right'
  | 'near'
  | 'far'
  | 'turnLeft'
  | 'turnRight'
  | 'stepForward'
  | 'stepBack'
  | 'answer'
  | 'replay'
  | 'contrast'
  | 'next'
  | 'acceptStretch'
  | 'observer'
  | 'settings'
  | 'help'
  | 'levelSelect';

export type EchoState = {
  phase: Phase;
  levelId: LevelId | null;
  /** Teaching track (§13.7): the open lesson and which page of it. */
  lessonId: number | null;
  lessonPage: number;
  runId: string | null;
  trialIndex: number;
  /** Trials in the current run (from the level definition). */
  trialCount: number;
  trial: Trial | null;
  pose: Pose;
  results: AnswerResult[];
  collisions: number;
  startedAt: number | null;
  clicksThisTrial: number;
  replays: number;
  contrasts: number;
  lastResult: AnswerResult | null;
  lastStimulus: AudioBuffer | null;
  lastVoices: EchoVoice[];
  lastHits: Hit[];
  /** Pose the last stimulus was rendered from; the observer view draws rays from here. */
  lastPose: Pose | null;
  /** Increments on every click so the observer view re-animates even when hits are identical. */
  shotId: number;
  stretchOffer: number | null;
  settings: Settings;
  /** Native only: TalkBack or another screen reader is on, so Echo's own voice and touch gestures stand down. */
  screenReaderOn: boolean;
  micOn: boolean;
  /** Tongue clicks detected this session (onboarding shows the count). */
  micClicks: number;
  /** Current text shown in BlindView and sent to narration/announcer. */
  message: string;
  /** Last text routed to the aria-live region; id changes so repeats are re-announced. */
  announcement: { text: string; id: number; isError: boolean };
  patch: (p: Partial<Omit<EchoState, 'patch' | 'setSettings'>>) => void;
  setSettings: (p: Partial<Settings>) => void;
};

export const DEFAULT_SETTINGS: Settings = {
  stretch: DEFAULT_STRETCH,
  narration: 'voice',
  clickSource: 'key',
  volume: 1,
  observer: false,
  morse: 'off',
  volumeKeys: true,
};

const onboarded = isOnboarded();

export const useEcho = create<EchoState>()((set) => ({
  // Returning users skip onboarding (§9.5); audio still unlocks on their first gesture.
  phase: onboarded ? 'levelSelect' : 'onboarding',
  levelId: null,
  lessonId: null,
  lessonPage: 0,
  runId: null,
  trialIndex: 0,
  trialCount: 0,
  trial: null,
  pose: { p: { x: 0, y: 0 }, headingDeg: 0 },
  results: [],
  collisions: 0,
  startedAt: null,
  clicksThisTrial: 0,
  replays: 0,
  contrasts: 0,
  lastResult: null,
  lastStimulus: null,
  lastVoices: [],
  lastHits: [],
  lastPose: null,
  shotId: 0,
  stretchOffer: null,
  // The mic needs a fresh permission grant each session, so every session starts on the Space key.
  settings: { ...DEFAULT_SETTINGS, ...loadSettings(), clickSource: 'key' },
  screenReaderOn: false,
  micOn: false,
  micClicks: 0,
  message: onboarded ? 'Welcome back. Choose a level.' : 'Echo. Press Start.',
  announcement: { text: '', id: 0, isError: false },
  patch: (p) => set(p),
  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
}));

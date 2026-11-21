// Zustand store (build_spec §8.2). Pure state + setters; flow logic lives in runner.ts.
import { create } from 'zustand';
import { DEFAULT_STRETCH } from '../config';
import type { AnswerResult, LevelDef, Trial } from '../levels/types';
import type { EchoVoice, Hit, Pose } from '../types';

export type Phase = 'onboarding' | 'levelSelect' | 'intro' | 'ready' | 'answered' | 'feedback' | 'summary';
export type Narration = 'voice' | 'screenreader';
export type ClickSource = 'key' | 'mic';
export type LevelId = LevelDef['id'];

export type Settings = {
  stretch: number;
  narration: Narration;
  clickSource: ClickSource;
  volume: number;
  observer: boolean;
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
  micOn: boolean;
  message: string;
  patch: (p: Partial<Omit<EchoState, 'patch' | 'setSettings'>>) => void;
  setSettings: (p: Partial<Settings>) => void;
};

export const DEFAULT_SETTINGS: Settings = {
  stretch: DEFAULT_STRETCH,
  narration: 'voice',
  clickSource: 'key',
  volume: 1,
  observer: false,
};

export const useEcho = create<EchoState>()((set) => ({
  phase: 'onboarding',
  levelId: null,
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
  settings: DEFAULT_SETTINGS,
  micOn: false,
  message: '',
  patch: (p) => set(p),
  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
}));

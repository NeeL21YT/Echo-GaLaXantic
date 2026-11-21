// User-facing labels shared by the views, written the way a voice would say them.
import { getLevel } from '../levels';
import { spokenDecimal, spokenNumber } from '../levels/feedback';
import { phrases } from '../input/inputStyle';
import type { Action, LevelId } from '../state/store';

export const START_PROMPT = 'Press any key or tap anywhere to start Echo.';

/** What the screen shows while the longer level-list instructions are spoken. */
export const LEVEL_LIST_HEADING = 'Choose a lesson or a level.';

export function levelSelectPrompt(): string {
  const custom = phrases().levelPrompt;
  if (custom) return custom;
  return 'Press 1 to 5 to start a level. Press Tab to reach lessons and the real room check. Press H for help.';
}

export function buttonSpeechLabel(label: string): string {
  return label.trim().replace(/\s*\(([^)]+)\)/g, ', $1').replace(/←/g, 'Left arrow').replace(/→/g, 'Right arrow');
}

export function stretchLabel(stretch: number): string {
  if (stretch === 1) return 'real speed';
  return `${spokenDecimal(stretch)} times slower`;
}

export function getLevelTitleLine(levelId: LevelId | null, trialIndex: number, trialCount: number): string {
  if (levelId === null) return '';
  const total = trialCount > 0 ? trialCount : getLevel(levelId).trials;
  return `Level ${spokenNumber(levelId)} · Trial ${spokenNumber(Math.min(trialIndex + 1, total))} of ${spokenNumber(total)}`;
}

/** Button text and its keyboard shortcut hint (§9.2). */
export const ACTION_LABELS: Record<Action, { label: string; key: string }> = {
  click: { label: 'Click', key: 'Space' },
  left: { label: 'Left', key: '←' },
  right: { label: 'Right', key: '→' },
  near: { label: 'Near', key: '1' },
  far: { label: 'Far', key: '2' },
  turnLeft: { label: 'Turn left', key: 'A' },
  turnRight: { label: 'Turn right', key: 'D' },
  stepForward: { label: 'Step forward', key: 'W' },
  stepBack: { label: 'Step back', key: 'S' },
  answer: { label: 'Answer', key: 'Enter' },
  replay: { label: 'Replay', key: 'R' },
  contrast: { label: 'Contrast', key: 'C' },
  next: { label: 'Next', key: 'N' },
  acceptStretch: { label: 'Yes, faster echoes', key: 'Y' },
  observer: { label: 'Observer view', key: 'V' },
  settings: { label: 'Settings', key: '' },
  help: { label: 'Help', key: 'H' },
  levelSelect: { label: 'Level list', key: 'Esc' },
  savePlace: { label: 'Save this place', key: 'P' },
  mark: { label: 'Mark what is here', key: 'M' },
  markWall: { label: 'Wall', key: '3' },
  markDoorway: { label: 'Doorway or opening', key: '4' },
  markStep: { label: 'Step or drop', key: '5' },
  markObstacle: { label: 'Obstacle', key: '6' },
};

type Score = { score: number; total: number } | null;

/** One spoken line of scores for a level, with empty fields left out; null when the level has no score yet. */
export function progressLine(levelId: LevelId, stats: { lastScore: Score; prevScore: Score; bestScore: Score }): string | null {
  const say = (s: NonNullable<Score>) => `${spokenNumber(s.score)} out of ${spokenNumber(s.total)}`;
  const parts: string[] = [];
  if (stats.lastScore) parts.push(`last ${say(stats.lastScore)}`);
  if (stats.prevScore) parts.push(`previous ${say(stats.prevScore)}`);
  if (stats.bestScore) parts.push(`best ${say(stats.bestScore)}`);
  return parts.length === 0 ? null : `Level ${spokenNumber(levelId)}: ${parts.join(', ')}.`;
}

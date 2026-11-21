// User-facing labels shared by the views, written the way a voice would say them.
import { getLevel, LEVELS } from '../levels';
import { phrases } from '../input/inputStyle';
import type { Action, LevelId } from '../state/store';

export const START_PROMPT = 'Press any key or tap anywhere to start Echo.';

/** What the screen shows while the longer level-list instructions are spoken. */
export const LEVEL_LIST_HEADING = 'Choose a lesson or a level.';

export function levelSelectPrompt(): string {
  const custom = phrases().levelPrompt;
  if (custom) return custom;
  const choices = LEVELS.map((level) => `${level.id} for ${level.title.replace(/[.?!]+$/, '')}`);
  return `Choose a level. Press ${choices.join(', ')}. Press H for help.`;
}

export function buttonSpeechLabel(label: string): string {
  return label.trim().replace(/\s*\(([^)]+)\)/g, ', $1').replace(/←/g, 'Left arrow').replace(/→/g, 'Right arrow');
}

export function stretchLabel(stretch: number): string {
  if (stretch === 1) return 'real speed';
  return `${stretch} times slower`;
}

export function getLevelTitleLine(levelId: LevelId | null, trialIndex: number, trialCount: number): string {
  if (levelId === null) return '';
  const total = trialCount > 0 ? trialCount : getLevel(levelId).trials;
  return `Level ${levelId} · Trial ${Math.min(trialIndex + 1, total)} of ${total}`;
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
  levelSelect: { label: 'Levels', key: 'Esc' },
};

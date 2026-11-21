import { describe, expect, it } from 'vitest';
import { commandForKey } from '../src/input/keyboard';
import { LEVELS } from '../src/levels';
import type { KeyboardContext, OnboardingAction } from '../src/types';
import { buttonSpeechLabel, levelSelectPrompt } from '../src/ui/labels';

describe('setup shortcuts', () => {
  it.each(['x', 'Enter', ' ', 'Tab', 'ArrowLeft', 'Shift', '1'])('starts on %j, including on the Start button', (key) => {
    expect(commandForKey(key, 'start', true)).toEqual({ type: 'onboarding', action: 'start' });
  });

  it.each<[KeyboardContext, string, OnboardingAction]>([
    ['narration', 'y', 'screenreader'],
    ['narration', 'Y', 'screenreader'],
    ['narration', 'n', 'voice'],
    ['narration', 'N', 'voice'],
    ['headphones', 'ArrowLeft', 'left'],
    ['headphones', 'ArrowRight', 'right'],
    ['mic', 'Enter', 'skipMic'],
    ['mic', 'n', 'skipMic'],
    ['mic', 'N', 'skipMic'],
    ['mic', 'm', 'enableMic'],
    ['mic', 'M', 'enableMic'],
    ['micTest', 'Enter', 'done'],
  ])('%s maps %j to %s', (step, key, action) => {
    expect(commandForKey(key, step)).toEqual({ type: 'onboarding', action });
  });

  it.each<[KeyboardContext, string]>([
    ['onboarding', 'n'], ['narration', 'm'], ['narration', 'Enter'],
    ['headphones', 'n'], ['mic', 'y'], ['micTest', 'n'], ['micTest', 'm'],
  ])('does not leak practice or other setup commands into %s for %j', (context, key) => {
    expect(commandForKey(key, context)).toBeNull();
  });
});

describe('phase-specific practice shortcuts', () => {
  it.each(LEVELS)('selects level $id only from the level list', (level) => {
    expect(commandForKey(String(level.id), 'levelSelect')).toEqual({ type: 'level', levelId: level.id });
  });

  it.each(['intro', 'ready', 'feedback', 'summary'] as const)('keeps near/far and excludes other level keys during %s', (phase) => {
    expect(commandForKey('1', phase)).toEqual({ type: 'action', action: 'near' });
    expect(commandForKey('2', phase)).toEqual({ type: 'action', action: 'far' });
    for (const key of ['3', '4', '5']) expect(commandForKey(key, phase)).toBeNull();
  });

  it.each(['h', 'H'])('routes level-list help on %s', (key) => {
    expect(commandForKey(key, 'levelSelect')).toEqual({ type: 'action', action: 'help' });
  });

  it.each(['n', 'N'])('keeps N as next outside setup', (key) => {
    expect(commandForKey(key, 'feedback')).toEqual({ type: 'action', action: 'next' });
  });

  it.each(['6', '0', 'F1', 'Tab'])('ignores unassigned key %j on the level list', (key) => {
    expect(commandForKey(key, 'levelSelect')).toBeNull();
  });

  it.each([' ', 'Enter'])('preserves native button activation for %j after Start', (key) => {
    for (const context of ['narration', 'headphones', 'mic', 'micTest', 'levelSelect', 'intro', 'ready', 'feedback'] as const) {
      expect(commandForKey(key, context, true)).toBeNull();
    }
  });

  it('keeps Enter and Space shortcuts when the practice container has focus', () => {
    expect(commandForKey('Enter', 'intro')).toEqual({ type: 'action', action: 'answer' });
    expect(commandForKey(' ', 'ready')).toEqual({ type: 'action', action: 'click' });
  });
});

describe('spoken hints', () => {
  it('names the level keys, the other cards and the help key', () => {
    expect(levelSelectPrompt()).toBe('Press 1 to 5 to start a level. Press Tab to reach lessons and the real room check. Press H for help.');
  });

  it.each([
    ['Replay (R)', 'Replay, R'],
    ['Left (←)', 'Left, Left arrow'],
    ['Right (→)', 'Right, Right arrow'],
    [' Skip, use the Space key (Enter or N) ', 'Skip, use the Space key, Enter or N'],
    ['Close settings', 'Close settings'],
  ])('speaks %j as %j', (label, spoken) => {
    expect(buttonSpeechLabel(label)).toBe(spoken);
  });
});

// How to tell the learner what to do, in the words of the way they are actually controlling Echo (§13.2).
// Pure so each wording can be tested. Keys talk about keys, touch talks about taps and swipes, and with a screen
// reader on, only the buttons are promised (the OS owns touch there).
export type InputStyle = 'keys' | 'touch' | 'buttons';

export function resolveInputStyle(o: { screenReaderOn: boolean; coarsePointer: boolean }): InputStyle {
  if (o.screenReaderOn) return 'buttons';
  return o.coarsePointer ? 'touch' : 'keys';
}

export type Phrases = {
  click: string;
  answerSide: string;
  answerDistance: string;
  turn: string;
  walk: string;
  faceDoor: string;
  begin: string;
  levelList: string;
  yes: string;
  clickFirst: string;
  feedbackHint: (hasContrast: boolean) => string;
  help: string;
  tone: (side: 'left' | 'right') => string;
  areaLabel: string;
  /** Full spoken level-list prompt, or null to build it from the level shortcut keys. */
  levelPrompt: string | null;
};

export const PHRASES: Record<InputStyle, Phrases> = {
  keys: {
    click: 'Press Space to click.',
    answerSide: 'Answer with the left or right arrow.',
    answerDistance: 'Press 1 for near or 2 for far.',
    turn: 'Turn with A and D.',
    walk: 'Walk with W and S.',
    faceDoor: 'Press Enter when you face the door.',
    begin: 'Press Enter to begin.',
    levelList: 'Press Enter for the level list.',
    yes: 'Press Y for yes.',
    clickFirst: 'Click first. Press Space to hear the room.',
    feedbackHint: (c) => ` Press R to replay${c ? ', C to compare' : ''}, or N for next.`,
    help: 'Space clicks. R replays. C compares. N goes to the next trial. V shows the observer view. Escape goes to the level list.',
    tone: (side) => `Press ${side} arrow when you hear the tone.`,
    areaLabel: 'Echo practice area. Press H for help.',
    levelPrompt: null,
  },
  touch: {
    click: 'Tap anywhere to click.',
    answerSide: 'Swipe left or right to answer.',
    answerDistance: 'Swipe up for far, or down for near.',
    turn: 'Swipe left or right to turn.',
    walk: 'Swipe up to step forward, or down to step back.',
    faceDoor: 'Press and hold when you face the door.',
    begin: 'Press and hold to begin.',
    levelList: 'Press and hold for the level list.',
    yes: 'Press and hold for yes.',
    clickFirst: 'Click first. Tap anywhere to hear the room.',
    feedbackHint: (c) => ` Double tap to replay${c ? ', triple tap to compare' : ''}, or press and hold for next.`,
    help: 'Tap to click. Double tap to replay. Triple tap to compare. Swipe to answer, turn or walk. Press and hold to continue. Tap with two fingers for help. Tap with three fingers for the level list.',
    tone: (side) => `Press the ${side} button when you hear the tone.`,
    areaLabel: 'Echo practice area. Tap with two fingers for help.',
    levelPrompt:
      'Choose a lesson or a level. Touch and hold a card to hear it, then lift and tap to open it. Or use the volume buttons: down moves through the list, up chooses.',
  },
  buttons: {
    click: 'Use the Click button.',
    answerSide: 'Use the Left and Right buttons to answer.',
    answerDistance: 'Use the Near and Far buttons to answer.',
    turn: 'Use the Turn left and Turn right buttons.',
    walk: 'Use the Step forward and Step back buttons.',
    faceDoor: 'Use the Answer button when you face the door.',
    begin: 'Use the Begin button.',
    levelList: 'Use the Next button for the level list.',
    yes: 'Use the Yes button.',
    clickFirst: 'Click first. Use the Click button to hear the room.',
    feedbackHint: (c) => ` Use the Replay${c ? ', Contrast' : ''} or Next button.`,
    help: 'Every action is a button: Click, the answers, Replay, Contrast, Next, Help and Levels.',
    tone: (side) => `Press the ${side} button when you hear the tone.`,
    areaLabel: 'Echo practice area. Use the Help button.',
    levelPrompt: 'Choose a lesson or a level. Every card is a button.',
  },
};

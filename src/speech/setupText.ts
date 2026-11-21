// What first-run setup says and labels its buttons, in the words of the way the learner controls Echo (§9.5).
// Pure so each wording can be tested. Keys talk about keys, touch about swipes and holds, buttons only about buttons.
import type { InputStyle } from './inputText';

const HEAR_BUTTONS = 'You can also touch and hold a button to hear it, then lift and tap it.';

export function narrationQuestion(style: InputStyle): string {
  if (style === 'keys') return 'Welcome to Echo. Do you use a screen reader? Press Y for yes or N for no, or tap a button.';
  if (style === 'touch') return `Welcome to Echo. Do you use a screen reader? Swipe up for yes. Press and hold for no. ${HEAR_BUTTONS}`;
  return 'Welcome to Echo. Do you use a screen reader? Choose Yes or No.';
}

/** Said instead of the question when the phone's own screen reader is already on. */
export const SCREEN_READER_DETECTED = 'Welcome to Echo. Your screen reader is on, so I will not speak over it.';

export function headphonesIntro(): string {
  return 'Headphone check. Put on your headphones.';
}

export function headphonesReversed(): string {
  return 'Your headphones may be reversed or not stereo. You can continue anyway.';
}

export function headphonesHelp(style: InputStyle): string {
  return style === 'touch' ? 'Swipe left or right toward the side where you hear the tone.' : '';
}

export function micQuestion(style: InputStyle): string {
  if (style === 'keys') {
    return 'Use your own tongue click? Press Enter or N to skip and click with the Space key. Press M to use the microphone, or tap a button. You can turn this on later in Settings.';
  }
  if (style === 'touch') {
    return `Use your own tongue click? Press and hold to skip, and tap the screen to click instead. Swipe up to use the microphone. ${HEAR_BUTTONS} You can turn this on later in Settings.`;
  }
  return 'Use your own tongue click? Choose Skip microphone to use the Click button, or choose Use my microphone. You can turn this on later in Settings.';
}

export function micAsking(): string {
  return 'Asking for the microphone. If the phone or browser asks, choose Allow.';
}

function doneHint(style: InputStyle): string {
  if (style === 'keys') return 'Press Enter, or tap Done, when finished.';
  return style === 'touch' ? 'Press and hold, or tap Done, when finished.' : 'Choose Done when finished.';
}

export function micTestPrompt(style: InputStyle, clicks: string): string {
  return `Click your tongue ${clicks} times. ${doneHint(style)}`;
}

export function micTestHeard(style: InputStyle, heard: string, enough: boolean): string {
  if (!enough) return `${heard} clicks heard so far.`;
  return `${heard} clicks heard. The microphone works. ${doneHint(style)}`;
}

/** Said when the learner finishes the test without the microphone hearing enough, so they know it is off. */
export const MIC_TEST_QUIET =
  'I did not hear enough clicks, so I switched the microphone off. You can turn it on again in Settings.';

export type SetupLabels = {
  yes: string;
  no: string;
  left: string;
  right: string;
  skipMic: string;
  enableMic: string;
  done: string;
};

export function setupLabels(style: InputStyle): SetupLabels {
  if (style === 'keys') {
    return {
      yes: 'Yes, I use a screen reader (Y)',
      no: 'No, speak to me (N)',
      left: 'Left (←)',
      right: 'Right (→)',
      skipMic: 'Skip microphone (Enter or N)',
      enableMic: 'Use my microphone (M)',
      done: 'Done (Enter)',
    };
  }
  return {
    yes: 'Yes, I use a screen reader',
    no: 'No, speak to me',
    left: 'Left',
    right: 'Right',
    skipMic: 'Skip microphone',
    enableMic: 'Use my microphone',
    done: 'Done',
  };
}

// Which way the learner is controlling Echo right now, for wording instructions (§13.2).
import { PHRASES, resolveInputStyle, type InputStyle, type Phrases } from '../speech/inputText';
import { useEcho } from '../state/store';

export function currentInputStyle(): InputStyle {
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
  return resolveInputStyle({ screenReaderOn: useEcho.getState().screenReaderOn, coarsePointer: coarse });
}

export const phrases = (): Phrases => PHRASES[currentInputStyle()];

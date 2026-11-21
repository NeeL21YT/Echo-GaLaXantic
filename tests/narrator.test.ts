import { describe, expect, it } from 'vitest';
import { NARRATION } from '../src/config';
import { nativeSpeechTimeoutMs } from '../src/speech/narrator';

describe('nativeSpeechTimeoutMs', () => {
  it('grows with the text and always leaves slack', () => {
    expect(nativeSpeechTimeoutMs('')).toBe(NARRATION.nativeSlackMs);
    expect(nativeSpeechTimeoutMs('hello')).toBe(5 * NARRATION.nativeMsPerChar + NARRATION.nativeSlackMs);
  });
});

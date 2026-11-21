export function getAudioContext(): AudioContext {
  throw new Error('not implemented: getAudioContext');
}

/** Creates/resumes the AudioContext. Must be called from a user gesture. */
export async function unlockAudio(): Promise<void> {
  throw new Error('not implemented: unlockAudio');
}

import type { EchoVoice } from '../types';

export async function renderStimulus(
  _voices: EchoVoice[],
  _opts: { includeDirect: boolean; seed?: number },
): Promise<AudioBuffer> {
  throw new Error('not implemented: renderStimulus');
}

// Waiting for speech we cannot observe. In voice mode `say` resolves when the voice stops; with a screen reader it
// only hands the text over, so a flow that must not talk over a sound (or over the microphone) waits an estimate.
import { SCREEN_READER_WAIT } from '../config';
import { say } from './runner';
import { useEcho } from './store';

/** About how long a screen reader needs to read this text. */
export function estimateReadMs(text: string): number {
  return text.length * SCREEN_READER_WAIT.msPerChar + SCREEN_READER_WAIT.slackMs;
}

/** Sleeps in short steps so a flow that was left or restarted stops waiting at once. */
export async function waitWhile(ms: number, stillWanted: () => boolean): Promise<void> {
  const step = 100;
  for (let waited = 0; waited < ms && stillWanted(); waited += step) {
    await new Promise<void>((resolve) => setTimeout(resolve, step));
  }
}

/** Says the text, and with a screen reader also waits for it to be read, so the next thing never cuts it off. */
export async function sayAndSettle(text: string, stillWanted: () => boolean = () => true, opts: { isError?: boolean; display?: string } = {}): Promise<void> {
  await say(text, opts);
  if (useEcho.getState().settings.narration === 'screenreader') await waitWhile(estimateReadMs(text), stillWanted);
}

/** Length of the text `ensureMicPermission` and `setClickSource` announce when the microphone is refused. */
const MIC_REFUSED_CHARS = 100;

/** After a refused microphone: with a screen reader, lets the runner's explanation be read before anything replaces it. */
export async function settleMicRefusal(stillWanted: () => boolean): Promise<void> {
  if (useEcho.getState().settings.narration === 'screenreader') await waitWhile(estimateReadMs('x'.repeat(MIC_REFUSED_CHARS)), stillWanted);
}

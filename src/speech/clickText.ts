// What the coach says about a click. Short, concrete, names the one thing to change; never harsh (CLAUDE.md).
import type { ClickVerdict } from '../engine/clickQuality';

export const CLICK_ADVICE: Record<ClickVerdict, string> = {
  good: 'Good click.',
  quiet: 'Too quiet. Click a little louder, and a little closer to the phone.',
  loud: 'Very loud. Click a little softer, or hold the phone farther away.',
  long: 'That one was long. Make it short and sharp, like tck.',
  dull: 'That one was soft. Pull your tongue down faster, and a little farther forward.',
};

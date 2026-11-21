// The phone's heading while the real-room check runs (§13.6 direction pass). Web-safe: with no heading sensor, or on a
// desktop, `currentHeading` stays null and the check behaves exactly as it did before, with no direction claims.
// The heading says which way the phone is held; it never says which way an echo came back.
import { HEADING } from '../config';
import { headingFromOrientation } from '../engine/roomDirection';

type Sample = { headingDeg: number; atMs: number };

let latest: Sample | null = null;
let listening = false;

function onOrientation(event: DeviceOrientationEvent): void {
  if (event.alpha === null || event.beta === null) return;
  const headingDeg = headingFromOrientation(event.alpha, event.beta);
  if (headingDeg === null) return;
  latest = { headingDeg, atMs: Date.now() };
}

/** True when this browser exposes an absolute heading event; Android WebView does, most desktops do not. */
const absoluteSupported = (): boolean => typeof window !== 'undefined' && 'ondeviceorientationabsolute' in window;

/** Starts listening, preferring the absolute event so the zero point never shifts under a visit. Idempotent. */
export function startCompass(): void {
  if (listening || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  listening = true;
  // Never both: their zero points differ, and mixing them would look like a turn that never happened.
  window.addEventListener(
    absoluteSupported() ? 'deviceorientationabsolute' : 'deviceorientation',
    onOrientation as EventListener,
  );
}

export function stopCompass(): void {
  if (!listening || typeof window === 'undefined') return;
  window.removeEventListener(
    absoluteSupported() ? 'deviceorientationabsolute' : 'deviceorientation',
    onOrientation as EventListener,
  );
  listening = false;
  latest = null;
}

/** The way the phone faced a moment ago, or null when there is no fresh sample. A stale heading is refused, never
 *  guessed: the learner may have turned since, and a wrong direction is worse than none. */
export function currentHeading(): number | null {
  if (!latest) return null;
  return Date.now() - latest.atMs <= HEADING.staleMs ? latest.headingDeg : null;
}

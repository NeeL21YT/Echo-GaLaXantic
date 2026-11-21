// Real-room ranging hardware (§13.6): plays the chirp through the phone speaker and records the room with the mic.
// The maths is in engine/ranging.ts. Works in total darkness because it is sound, not light.
import { RANGING } from '../config';
import { combinePings, estimateNearestSurface, makeChirp, pingsDisagree, type Range } from '../engine/ranging';
import { getAudioContext } from './context';

type Session = { stream: MediaStream; source: MediaStreamAudioSourceNode };
let session: Session | null = null;
/** Bumped by every close, so a ping or an open still in flight can tell the learner has left. */
let generation = 0;
let chirpSource: AudioBufferSourceNode | null = null;
/** Set by the last measurement when its pings disagreed, cleared by the next one. */
let lastRough = false;

/** Opens the mic once for a run of pings. Throws if the microphone is blocked. */
export async function openRanger(): Promise<void> {
  if (session) return;
  const opening = generation;
  // Echo cancellation would remove exactly the reflections we want to hear.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  if (opening !== generation) {
    for (const t of stream.getTracks()) t.stop();
    throw new Error('ranger closed while opening');
  }
  session = { stream, source: new MediaStreamAudioSourceNode(getAudioContext(), { mediaStream: stream }) };
}

/**
 * True when the phone reports that it is filtering the microphone anyway. Echo cancellation removes exactly the direct
 * path and the near reflections this check measures, and automatic gain control squashes the echo's level, so when the
 * phone insists on either, the learner is told the numbers may be wrong rather than handed a confident guess.
 * Unknown counts as no: many devices report nothing even when the constraint was applied.
 */
export function audioFiltered(): boolean {
  const track = session?.stream.getAudioTracks()[0];
  if (!track || typeof track.getSettings !== 'function') return false;
  const settings = track.getSettings();
  return settings.echoCancellation === true || settings.autoGainControl === true || settings.noiseSuppression === true;
}

export function closeRanger(): void {
  generation += 1;
  try {
    chirpSource?.stop();
  } catch {
    // Already finished.
  }
  chirpSource = null;
  if (!session) return;
  session.source.disconnect();
  for (const t of session.stream.getTracks()) t.stop();
  session = null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** One ping: start recording, play the chirp a moment later, stop when the take is full. Null when nothing was heard or the ranger was closed. */
async function pingOnce(): Promise<Range | null> {
  const open = session;
  if (!open) throw new Error('Ranger is not open');
  const mine = generation;
  const ctx = getAudioContext();
  const rate = ctx.sampleRate;
  const chirp = makeChirp(rate);
  const take = new Float32Array(Math.round(RANGING.recordS * rate));
  let filled = 0;

  // ScriptProcessor is deprecated but needs no worklet file and works in every WebView Echo targets.
  const processor = ctx.createScriptProcessor(1024, 1, 1);
  const mute = new GainNode(ctx, { gain: 0 });
  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const n = Math.min(input.length, take.length - filled);
    take.set(input.subarray(0, n), filled);
    filled += n;
  };
  const release = () => {
    processor.onaudioprocess = null;
    // The source may already be disconnected when the learner left mid-ping.
    try {
      open.source.disconnect(processor);
    } catch {
      // Nothing connected.
    }
    processor.disconnect();
    mute.disconnect();
  };
  open.source.connect(processor);
  processor.connect(mute).connect(ctx.destination);

  const buffer = new AudioBuffer({ length: chirp.length, sampleRate: rate });
  buffer.copyToChannel(chirp, 0);
  const src = new AudioBufferSourceNode(ctx, { buffer });
  src.connect(ctx.destination);
  await sleep(30); // let recording settle before the chirp
  if (mine !== generation) {
    release();
    return null;
  }
  chirpSource = src;
  src.start();
  // The extra time beyond the take is slack, not recording: a slow first callback then cannot shorten the take, while
  // the fill check below still catches a take that genuinely lost audio.
  await sleep(RANGING.recordS * 1000 + 100);
  chirpSource = null;
  // A take that lost audio callbacks has gaps, and a gap shortens every distance in it, so it is thrown away rather
  // than measured. The wall clock is fixed, so missing samples mean missing time.
  const complete = filled >= take.length * RANGING.minFilledFraction;
  release();
  if (mine !== generation || !complete) return null;
  return estimateNearestSurface(take, chirp, rate);
}

/** Pings several times and returns the median nearest surface, or null when most pings found nothing or the ranger was closed. */
export async function measureNearestSurface(): Promise<Range | null> {
  const mine = generation;
  const results: (Range | null)[] = [];
  lastRough = false;
  for (let i = 0; i < RANGING.pings; i++) {
    if (mine !== generation) return null;
    results.push(await pingOnce());
    await sleep(RANGING.pingGapMs);
  }
  if (mine !== generation) return null;
  const range = combinePings(results);
  lastRough = range !== null && pingsDisagree(results);
  return range;
}

/** True when the pings of the last measurement disagreed; its distance is a middle, not a measurement. */
export function takeWasRough(): boolean {
  return lastRough;
}

// Real-room ranging hardware (§13.6): plays the chirp through the phone speaker and records the room with the mic.
// The maths is in engine/ranging.ts. Works in total darkness because it is sound, not light.
import { RANGING } from '../config';
import { combinePings, estimateNearestSurface, makeChirp, type Range } from '../engine/ranging';
import { getAudioContext } from './context';

type Session = { stream: MediaStream; source: MediaStreamAudioSourceNode };
let session: Session | null = null;
/** Bumped by every close, so a ping or an open still in flight can tell the learner has left. */
let generation = 0;
let chirpSource: AudioBufferSourceNode | null = null;

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
  await sleep(RANGING.recordS * 1000 + 50);
  chirpSource = null;
  release();
  return mine === generation ? estimateNearestSurface(take, chirp, rate) : null;
}

/** Pings several times and returns the median nearest surface, or null when most pings found nothing or the ranger was closed. */
export async function measureNearestSurface(): Promise<Range | null> {
  const mine = generation;
  const results: (Range | null)[] = [];
  for (let i = 0; i < RANGING.pings; i++) {
    if (mine !== generation) return null;
    results.push(await pingOnce());
    await sleep(RANGING.pingGapMs);
  }
  return mine === generation ? combinePings(results) : null;
}

// Mic capture for the click coach (§13.7). Watches for the learner's tongue clicks and hands each one, as a short
// window of raw samples, to the pure analyser. Module singleton with explicit start/stop, like micDetector.
import { CLICK_COACH } from '../config';
import { analyzeClick, type ClickReport } from '../engine/clickQuality';
import { isSpeaking } from '../speech/narrator';
import { getAudioContext } from './context';
import { isPlaying } from './player';

type Coach = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  mute: GainNode;
};

let coach: Coach | null = null;
/** Bumped by every stop, so a start still waiting on the permission prompt can tell it was cancelled. */
let generation = 0;

/** Starts listening; onClick gets one report per detected click. Throws if the microphone is blocked. */
export async function startClickCoach(onClick: (report: ClickReport) => void): Promise<void> {
  stopClickCoach();
  const started = generation;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  // The learner left the page while the permission prompt was open: release the mic, do not start listening.
  if (started !== generation) {
    for (const t of stream.getTracks()) t.stop();
    return;
  }
  const ctx = getAudioContext();
  const rate = ctx.sampleRate;
  const pre = Math.round((CLICK_COACH.preMs / 1000) * rate);
  const post = Math.round((CLICK_COACH.postMs / 1000) * rate);
  const ring = new Float32Array(Math.round(rate * 0.5));
  let written = 0; // absolute sample count
  let floor = 0;
  let prev = 0;
  let lastTriggerAt = -Infinity;
  let pendingOnset = -1; // absolute index of a detected onset still waiting for its tail

  const at = (abs: number) => ring[((abs % ring.length) + ring.length) % ring.length] ?? 0;

  const source = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream });
  // ScriptProcessor is deprecated but works everywhere Echo runs and needs no separate worklet file (no new bundler setup).
  const processor = ctx.createScriptProcessor(1024, 1, 1);
  // The processor only runs while connected to the destination, so it goes through a muted gain.
  const mute = new GainNode(ctx, { gain: 0 });

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    // Ignore our own speech and playback leaking into the mic; anything pending from before is dropped too.
    const busy = isPlaying() || isSpeaking();
    for (let i = 0; i < input.length; i++) {
      const x = input[i] ?? 0;
      ring[written % ring.length] = x;
      const diff = Math.abs(x - prev);
      prev = x;
      const threshold = Math.max(CLICK_COACH.onsetMinDiff, floor * CLICK_COACH.onsetFloorMultiplier);
      const nowMs = ((written + i) / rate) * 1000;
      if (!busy && pendingOnset < 0 && nowMs - lastTriggerAt > CLICK_COACH.refractoryMs && diff > threshold) {
        pendingOnset = written;
        lastTriggerAt = nowMs;
      } else if (pendingOnset < 0) {
        floor += CLICK_COACH.onsetFloorAlpha * (diff - floor);
      }
      written += 1;
      if (pendingOnset >= 0 && written - pendingOnset >= post) {
        const start = pendingOnset - pre;
        const window = new Float32Array(pre + post);
        for (let k = 0; k < window.length; k++) window[k] = at(start + k);
        pendingOnset = -1;
        onClick(analyzeClick(window, rate));
      }
    }
  };

  source.connect(processor);
  processor.connect(mute).connect(ctx.destination);
  coach = { stream, source, processor, mute };
}

export function stopClickCoach(): void {
  generation += 1;
  if (!coach) return;
  coach.processor.onaudioprocess = null;
  coach.source.disconnect();
  coach.processor.disconnect();
  coach.mute.disconnect();
  for (const t of coach.stream.getTracks()) t.stop();
  coach = null;
}

export function isClickCoachOn(): boolean {
  return coach !== null;
}

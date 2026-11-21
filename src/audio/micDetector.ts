// Tongue-click detection (§6.6): high-passed mic → peak follower with an adaptive noise floor.
import { MIC } from '../config';
import { isSpeaking } from '../speech/narrator';
import { getAudioContext } from './context';
import { isPlaying } from './player';

type Detector = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Float32Array<ArrayBuffer>;
  raf: number;
};

let det: Detector | null = null;
/** Bumped by every stop, so a start still waiting on the permission prompt can tell it was cancelled. */
let generation = 0;
let report = 'Microphone is off.';

/**
 * Starts listening; calls onClick for each detected click. Throws if permission is denied.
 * onEnded runs once if the phone or browser takes the microphone away mid-run (permission revoked, another app, unplugged).
 */
export async function start(onClick: () => void, onEnded?: () => void): Promise<void> {
  stop();
  const started = generation;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  // Cancelled while the permission prompt was open: the mic must not stay on behind the learner's back.
  if (started !== generation) {
    for (const t of stream.getTracks()) t.stop();
    throw new Error('microphone start cancelled');
  }
  const track = stream.getAudioTracks()[0];
  track?.addEventListener('ended', () => {
    // Only the stream that is still current counts; stop() and a restart release old tracks on purpose.
    if (det?.stream !== stream) return;
    stop();
    onEnded?.();
  });
  const s = track?.getSettings();
  const onOff = (v: boolean | string | undefined) =>
    v === undefined ? 'unknown' : typeof v === 'string' ? v : v ? 'on' : 'off';
  // Browsers may ignore our constraints; Settings shows what was actually applied.
  report = `Echo cancellation ${onOff(s?.echoCancellation)}. Noise suppression ${onOff(s?.noiseSuppression)}. Auto gain ${onOff(s?.autoGainControl)}.`;

  const ctx = getAudioContext();
  const source = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream });
  const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: MIC.highpassHz });
  const analyser = new AnalyserNode(ctx, { fftSize: MIC.fftSize });
  source.connect(hp).connect(analyser);

  const data = new Float32Array(new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT));
  let floor = 0;
  let lastTrigger = -Infinity;

  const poll = () => {
    if (!det) return;
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] ?? 0));
    const now = performance.now();
    const threshold = Math.max(MIC.minPeak, floor * MIC.floorMultiplier);
    // Headphone bleed from our own stimulus or speech could re-trigger, so those moments are ignored.
    const busy = isPlaying() || isSpeaking();
    const refractoryOver = now - lastTrigger > MIC.refractoryMs;
    if (!busy && refractoryOver) {
      if (peak > threshold) {
        lastTrigger = now;
        onClick();
      } else {
        // The floor learns only from quiet, untriggered frames, so neither a click nor our own playback raises it.
        floor = floor + MIC.floorEmaAlpha * (peak - floor);
      }
    }
    det.raf = requestAnimationFrame(poll);
  };

  det = { stream, source, analyser, data, raf: requestAnimationFrame(poll) };
}

export function stop(): void {
  generation += 1;
  if (!det) return;
  cancelAnimationFrame(det.raf);
  det.source.disconnect();
  for (const t of det.stream.getTracks()) t.stop();
  det = null;
  report = 'Microphone is off.';
}

export function isOn(): boolean {
  return det !== null;
}

export function getSettingsReport(): string {
  return report;
}

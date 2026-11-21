import {
  CLICK,
  CLIP_WARN_PEAK,
  DIRECT_CLICK_GAIN,
  LOWPASS_Q,
  SAMPLE_RATE,
  STIMULUS_TAIL_S,
} from '../config';
import type { EchoVoice } from '../types';
import { getReferenceClick } from './referenceClick';

export type RenderOptions = { includeDirect: boolean; seed?: number };

/**
 * Renders one click and its echoes offline (§6.3). Offline rendering makes echo timing sample-exact and lets
 * replay/contrast play the identical buffer. Levels are never normalised per scene — that would change the cues.
 */
export async function renderStimulus(voices: EchoVoice[], opts: RenderOptions): Promise<AudioBuffer> {
  const click = getReferenceClick();
  // An empty voice list is valid (e.g. the "no wall" contrast), so the max starts at 0, not -Infinity.
  const maxDelay = voices.reduce((m, v) => (Number.isFinite(v.delayS) ? Math.max(m, v.delayS) : m), 0);
  const frames = Math.ceil((maxDelay + CLICK.durationS + STIMULUS_TAIL_S) * SAMPLE_RATE);
  const off = new OfflineAudioContext(2, frames, SAMPLE_RATE);

  // Listener at the origin facing −z (Web Audio default), stated explicitly so it can't drift.
  const l = off.listener;
  if (l.positionX) {
    l.positionX.value = 0;
    l.positionY.value = 0;
    l.positionZ.value = 0;
    l.forwardX.value = 0;
    l.forwardY.value = 0;
    l.forwardZ.value = -1;
    l.upX.value = 0;
    l.upY.value = 1;
    l.upZ.value = 0;
  }

  if (opts.includeDirect) {
    const src = new AudioBufferSourceNode(off, { buffer: click });
    const g = new GainNode(off, { gain: DIRECT_CLICK_GAIN });
    src.connect(g).connect(off.destination);
    src.start(0);
  }

  for (const v of voices) {
    if (!Number.isFinite(v.delayS) || v.gain <= 0) continue;
    const src = new AudioBufferSourceNode(off, { buffer: click });
    const lp = new BiquadFilterNode(off, { type: 'lowpass', frequency: v.cutoffHz, Q: LOWPASS_Q });
    const g = new GainNode(off, { gain: v.gain });
    const az = (v.azDeg * Math.PI) / 180;
    // rolloffFactor 0: distance loudness comes only from our gain formula; the panner only spatialises.
    const pan = new PannerNode(off, {
      panningModel: 'HRTF',
      distanceModel: 'linear',
      rolloffFactor: 0,
      refDistance: 1,
      maxDistance: 10000,
      positionX: Math.sin(az),
      positionY: 0,
      positionZ: -Math.cos(az),
    });
    src.connect(lp).connect(g).connect(pan).connect(off.destination);
    src.start(v.delayS);
  }

  const buf = await off.startRendering();
  const peak = bufferPeak(buf);
  if (peak > CLIP_WARN_PEAK) {
    console.warn(`Stimulus peak ${peak.toFixed(3)} > ${CLIP_WARN_PEAK} (seed ${opts.seed ?? 'n/a'})`);
  }
  return buf;
}

export function bufferPeak(buf: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] ?? 0));
  }
  return peak;
}

// Every tunable number in Echo lives here (CLAUDE.md: no magic numbers elsewhere).
// Changing any value that affects a rendered stimulus means bumping RENDER_VERSION.

export const SPEED_OF_SOUND = 343;          // m/s
export const RAY_COUNT = 72;                // one every 5°
export const RAY_STEP_DEG = 360 / RAY_COUNT;
export const MAX_RANGE_M = 8;               // hits must be strictly closer than this
export const MIN_DIST_M = 0.3;              // clamp to avoid gain blow-up
export const MAX_VOICES = 24;
export const MERGE_AZ_BIN_DEG = 15;
export const MERGE_DIST_BIN_M = 0.25;

export const ECHO_GAIN_SCALE = 1.0;         // TUNE at the hour-10 gate (deck formula × this)
export const DIRECT_CLICK_GAIN = 0.5;       // direct path in key mode; 0 in mic mode
export const LOWPASS_NUMERATOR_HZ = 9000;   // cutoff = 9000 / (1 + d)
export const LOWPASS_Q = 0.707;

export const REFLECTANCE = { wall: 0.9, pole: 0.7 } as const;

export const STRETCH_STEPS = [8, 6, 4, 3, 2, 1.5, 1] as const;
export const DEFAULT_STRETCH = 4;
export const PASSES_TO_SUGGEST_LOWER = 3;

export const MASTER_GAIN = 0.8;
export const LIMITER = { threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.1 };
export const SAMPLE_RATE = 48000;
export const STIMULUS_TAIL_S = 0.1;

export const STEP_M = 0.5;                  // W/S
export const TURN_DEG = 15;                 // A/D
export const PLAYER_RADIUS_M = 0.25;
export const POLE_RADIUS_M = 0.15;

export const MIC = {
  highpassHz: 1500,
  minPeak: 0.15,
  floorMultiplier: 8,
  floorEmaAlpha: 0.05,
  refractoryMs: 300,
  // §6.6 says 512; at 48 kHz that is 10.7 ms, shorter than one animation frame, so a 3 ms click could fall
  // between polls. 1024 (21 ms) covers a frame. See Decisions log.
  fftSize: 1024,
};

export const RENDER_VERSION = 1;            // bump when the echo model changes; logged per trial

// --- Additions beyond spec §4 (see CLAUDE.md Decisions log) ---

// Hits closer than this are treated as numerical noise from a ray starting on a surface.
export const HIT_EPSILON_M = 1e-6;

// Reference click (§6.2).
export const CLICK = {
  durationS: 0.004,
  freqHz: 3200,
  decayTauS: 0.0006,
  noiseMix: 0.15,
  peak: 0.8,
  // Fixed noise seed: every render uses the identical click, so replays and contrasts compare like with like.
  noiseSeed: 0x0ec40,
};

// A rendered stimulus peak above this logs a warning (never rescaled).
export const CLIP_WARN_PEAK = 0.98;

// Procedural sound effects (§6.5). Gains are linear, before the master bus.
export const SFX = {
  gain: 0.35,
  bump: { freqHz: 120, durS: 0.08 },
  correct: { freqsHz: [660, 880], noteS: 0.08 },
  wrong: { freqHz: 330, durS: 0.15, gain: 0.2 },
  levelUp: { freqsHz: [523.25, 659.25, 783.99], noteS: 0.1 },
  lrTest: { freqHz: 1000, durS: 0.6 },
  footstep: { durS: 0.03, bandHz: 800, q: 1.2, gain: 0.25 },
  // Short fades stop clicks at tone edges.
  fadeS: 0.005,
  silenceGain: 0.0001,
};

// Observer view (§9.1).
export const OBSERVER = {
  pxPerM: 60,
  rayAnimMs: 400,
  wallPx: 4,
  playerSizeM: 0.35,
  hitDotPx: 4,
  // Escaped rays stay faint so the doorway gap reads as "nothing came back".
  escapedAlpha: 0.12,
  hitRayAlpha: 0.35,
  minHitAlpha: 0.15,
  marginPx: 24,
};

// Narration (§9.4).
export const NARRATION = {
  rate: 1.05,
  lang: 'en',
  idlePollMs: 50,
  // Screen-reader mode can't tell when NVDA finishes, so a contrast label gets this much room before its sound.
  screenReaderLabelGapMs: 1500,
};

// Feedback (§7.3).
export const CONTRAST_PAUSE_MS = 400;

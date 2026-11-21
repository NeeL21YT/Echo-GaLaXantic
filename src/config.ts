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
// Fixed pre-gain on every stimulus (direct click and echoes alike), so all relative cues are untouched.
// Why: up to 24 echo voices at near-identical delays add coherently when the player is ~0.25-0.4 m from two walls,
// and the unscaled sum peaked at 4.67 (L4/L5 corridor corners) and 2.15 (L3 room corners) against the 0.98
// clip limit (§10.2). 0.18 puts the worst reachable pose at about 0.84. Per-scene normalising is forbidden.
export const STIMULUS_GAIN = 0.18;
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

export const RENDER_VERSION = 3;            // bump when the echo model changes; logged per trial

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
  // A soft tick per turn, so a blind learner knows each turn press or swipe registered.
  turn: { freqHz: 500, durS: 0.03, gain: 0.2 },
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
  // If the phone's speech engine never reports the end of an utterance, waiting on it would block every sound
  // that follows. After this long (per character plus slack) it is treated as finished.
  nativeMsPerChar: 150,
  nativeSlackMs: 5000,
};

// Feedback (§7.3).
export const CONTRAST_PAUSE_MS = 400;

// Setup thresholds do not affect rendered sound.
export const ONBOARDING = { micTestClicks: 3, headphoneMisses: 2 } as const;

// Level definitions (§7.2). Pass thresholds are "exactly as submitted" — change only with a Decisions log line.
export const LEVEL = {
  l1: { wallDistM: 1.5, trials: 10, passCorrect: 8 },
  l2: { nearM: 1.0, farM: 3.0, trials: 10, passCorrect: 8 },
  l3: {
    roomM: 6,
    gapWidthM: 1.0,
    cornerMarginM: 0.75, // from the gap EDGE to the corner
    headingStepDeg: 15,
    toleranceDeg: 20,
    trials: 5,
    passCorrect: 4,
  },
  l4: {
    widthM: 2,
    lengthM: 10,
    poleXM: [-0.5, 0.5] as const,
    poleYM: [3, 7] as const,
    trials: 3,
    passRuns: 2,
  },
  l5: { timeLimitS: 90, trials: 1 },
  // Corridor and L-corridor start this far in from the closed back wall.
  startInsetM: 0.5,
};

// Fixed Mulberry32 mixing parameters keep trial seeds reproducible across callers.
export const MULBERRY32 = {
  increment: 0x6d2b79f5,
  firstShift: 15,
  secondShift: 7,
  finalShift: 14,
  mixMask: 61,
  uint32Range: 0x1_0000_0000,
} as const;

// Trial seed mixing and spoken direction thresholds; these do not change the echo model.
export const LEVEL_FEEDBACK = {
  trialSeedMix: 0x9e3779b1,
  fullTurnDeg: 360,
  degreeRoundStep: 5,
  behindDeg: 150,
  slightlyDeg: 30,
  wallAheadDeg: 45,
  half: 0.5, // A stretch step of one and a half is spoken as a half.
  numberBase: 10, // Decimal groups for spoken counts and time limits.
} as const;

// --- Mobile (build_spec §13) ---

export const GESTURE = {
  /** A second tap must land within this window to count as part of a multi-tap. */
  tapWindowMs: 280,
  /** Longest touch that still counts as a tap. */
  tapMaxMs: 250,
  /** A touch held this long without moving is a long press. */
  longPressMs: 600,
  /** Movement below this is finger wobble, not a swipe. Blind users touch less precisely, so keep it forgiving. */
  swipeMinPx: 48,
  swipeMaxMs: 800,
  /** Max drift of a tap or long press, in px. */
  tapSlopPx: 24,
  /** All fingers of a multi-finger tap must land within this window. */
  multiFingerWindowMs: 120,
  /** Confirmation tick so the user knows a gesture registered. */
  tickMs: 20,
  /** Least time between spoken "that does nothing here" hints, so repeated taps do not talk over each other. */
  ignoredHintGapMs: 6000,
  /** Holding a finger on a control this long reads it aloud instead of pressing it. Shorter than longPressMs so the two never clash. */
  readAloudMs: 450,
  /** A click arriving this soon after a read-aloud is the lift of that same touch, so it is swallowed. */
  suppressClickMs: 400,
  /** A finger down this long with no lift is a lost lift (the element vanished, the OS took the touch); the next touch starts clean. */
  staleTouchMs: 2000,
  /** Android cancels the pointer when its own long-press starts, around 400-500 ms. A cancel after this long, with no movement, is that. */
  cancelHoldMs: 300,
};

// Volume keys (§13.3).
export const VOLUME_KEY = {
  /** A held key repeats; the same key within this long is the same press. */
  repeatGuardMs: 150,
};

export const MORSE = {
  unitMs: 120,
  toneHz: 650,
  toneGain: 0.3,
  /** Fixed messages, so a user can learn them: OK = pass, TRY = miss, B = bump. */
  pass: 'OK',
  miss: 'TRY',
  bump: 'B',
};

// Real-room ranging (§13.6).
export const RANGING = {
  chirpDurationS: 0.004,
  chirpStartHz: 2000,
  chirpEndHz: 9000,
  chirpGain: 0.7,
  /** Recording length per ping. Android output latency can exceed 100 ms, so the chirp lands late in the take. */
  recordS: 0.3,
  pings: 5,
  pingGapMs: 120,
  /** Echoes closer than this to the direct path are speaker ringing, not a wall. */
  minDistanceM: 0.3,
  maxDistanceM: 5,
  /** An echo must beat the median background level by this factor. */
  peakToNoise: 6,
  /** An echo must reach at least this fraction of the direct-path peak. */
  // Above the chirp's own correlation sidelobes (Hann-windowed, about -30 dB = 0.03).
  minRelativeStrength: 0.05,
  /** Guess steps and tolerance for "close" (§13.6). */
  guessStepM: 0.5,
  guessStartM: 1,
  guessMaxM: 5,
  closeToleranceM: 0.5,
  passesToFade: 3,
};

// Direction pass for the real-room check (§13.6). One phone microphone cannot tell which way an echo came from, so
// these only ever describe the way the phone was held at ping time; they never claim the echo's direction.
export const HEADING = {
  /** A sample older than this is not used: the phone may have been turned or covered since it was taken. */
  staleMs: 1500,
  /** Below this |cos beta| the phone points nearly straight up or down, where a heading is not trustworthy. */
  minHorizontal: 0.35,
  /** Two pings count as the same direction when their headings differ by less than this. */
  sameDirectionDeg: 20,
  /** Spoken turns are rounded to this, so the wording never claims more precision than a wave of the arm. */
  turnRoundDeg: 15,
  /** A net turn at least this large is said as "turned around". */
  turnAroundDeg: 150,
  /** Distinct directions needed before the check will name the nearest one. */
  directionsForSummary: 2,
} as const;

// Click coach (§13.7): judges the learner's own tongue click from the mic. Thresholds are first guesses for a phone
// mic about 10-20 cm from the mouth with AGC off; tune them against real clicks on a device.
export const CLICK_COACH = {
  /** Window analysed around each click: a little before the onset, then enough to see the decay. */
  preMs: 2,
  postMs: 60,
  /** Onset detector works on the first difference (a cheap high-pass) so room rumble and breath don't trigger it. */
  onsetMinDiff: 0.03,
  onsetFloorMultiplier: 6,
  onsetFloorAlpha: 0.02,
  refractoryMs: 450,
  /** Raw peak limits: below quietPeak is too soft to give a clear echo, above loudPeak is clipping. */
  quietPeak: 0.06,
  loudPeak: 0.95,
  /** A sharp click's energy is gone quickly; longer than this is a cluck, a word or a hiss. */
  maxDurationMs: 20,
  envelopeSmoothMs: 1,
  /** The click "ends" when the smoothed envelope falls below this fraction of its peak. */
  decayFraction: 0.25,
  /** Share of energy above lowpassHz. A palatal click is bright; a soft tongue pop is not. */
  lowpassHz: 1500,
  minBrightness: 0.4,
  /** The coach ends after this many good clicks. */
  goodNeeded: 5,
  /** A good click gets a tone; after this many misses in a row the coach offers to move on. */
  missesBeforeOffer: 6,
};

// "Feel the answer" patterns (§13.9): alternating on/off milliseconds, starting with "on". Each must differ from the
// others by count or length so they can be told apart by touch alone; keep each under maxTotalMs.
export const HAPTIC = {
  maxTotalMs: 700,
  left: [70],                       // one short buzz
  right: [70, 90, 70],              // two short buzzes
  near: [30],                       // one very short tick
  far: [320],                       // one long buzz
  pass: [40, 50, 70, 50, 140],      // three buzzes, growing: "up"
  miss: [200, 100, 50],             // long then short: "down"
  bump: [120, 60, 120, 60, 120],    // three even buzzes
} as const;

// Local storage bounds: old entries are dropped first, so a full or slow device never blocks a run.
export const STORAGE_LIMITS = {
  maxTrials: 400,
  maxRuns: 200,
  maxLessons: 50,
  /** Pause after the last volume-slider step before the new level is spoken. */
  volumeSpeechDebounceMs: 400,
} as const;

// Screen-reader mode cannot see when TalkBack or NVDA finishes reading, so a flow that must not talk over a sound,
// or over the microphone, waits this long per character of what it just announced.
export const SCREEN_READER_WAIT = {
  msPerChar: 70,
  slackMs: 700,
};

// A tone or tick the click coach plays leaks into the mic; clicks heard this soon after our own sound are ignored.
export const COACH_QUIET_AFTER_TONE_MS = 600;

// After this many "no wall found" pings in a row the real-room check adds a tip about the room.
export const ROOM_FAILS_BEFORE_TIP = 2;

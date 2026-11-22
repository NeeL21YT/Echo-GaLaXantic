# Echo — Build Spec

**Team GaLaXantic · Orbix 48-Hour Global Open Innovation Hackathon (21–23 Nov 2026)**

This is the source of truth for **what** gets built and **how**. If code disagrees with this file, either the code is wrong or this file must be updated in the same commit. Constants live in `src/config.ts` and nowhere else.

---

## 0. One-paragraph summary

Echo is a browser-based echolocation practice space. The player wears headphones and clicks: Space plays a reference click, or the player makes a real tongue click into the mic. Echo casts 72 rays through a 2D virtual room. Each hit becomes an echo with its own delay, loudness, tone and HRTF direction, and the echoes play through headphones. A gap in a wall returns no echo, so a doorway is heard as silence. Five levels each teach one skill. "Training wheels" stretch echo delays (8× → 1×) so beginners can separate reflections. After every answer Echo explains what to listen for and offers a replay and an A/B contrast. A black "blind view" works entirely by voice and keyboard. An "observer view" draws the rays for sighted spectators. There is no backend, no ML and no network after first load.

---

## 1. Hard constraints

| Constraint | Value |
|---|---|
| Platform | Desktop browser. Chrome is primary; Firefox is secondary. Android (Capacitor APK) is part of `main` since the `mobile` work was merged on 22 Nov 2026 — see §13. |
| Output | Headphones (wired is the tested setup) |
| Stack | React 18, Vite, TypeScript (strict), Web Audio API, Canvas 2D, Web Speech API, Zustand, Vitest |
| Backend | None. Static deploy on Vercel. |
| Network | None after first load. No external APIs, fonts or CDNs. |
| Storage | `localStorage` only (settings and trial log) |
| Model | 2D, specular-ish reflection, no diffraction, no reverb tail. Simplified by design; we say so. |
| Build window | 36 h of build time. Feature freeze at **hour 29**. |

**Not in the MVP (do not build):** 3D geometry, Three.js, noise ladder, material recognition, a personalised recorded-click waveform, threshold/staircase estimation, accounts, backend, mobile layout, phone head-tracking, real floor plans.

---

## 2. Architecture

```
            ┌──────────── input ─────────────┐
 Keyboard ──┤ keyboard.ts (ignores repeats)  │
 Buttons  ──┤ Controls.tsx                   ├──► actions ──► store (Zustand)
 Mic      ──┤ micDetector.ts (onset → click) │                    │
            └────────────────────────────────┘                    ▼
                                                        levelRunner (state machine)
                                                                  │ world + pose
                                                                  ▼
                       raycaster.ts ──hits──► echoBuilder.ts ──voices──► stimulus.ts
                       (72 rays, 8 m)         (delay, gain, cutoff,      (OfflineAudioContext
                                              azimuth, merge ≤24)         render → AudioBuffer)
                                                                  │
                                                                  ▼
                                                          player.ts → master bus
                                                          (gain → limiter → out)
                                                                  │
                           narrator.ts / announcer ◄──── feedback.ts (explain, replay, contrast)
                           (speech OR aria-live)
                                                                  │
                           BlindView.tsx  ·  ObserverView.tsx (Canvas 2D)  ·  progress.ts (localStorage)
```

### Key design decisions
1. **Every stimulus is pre-rendered** with `OfflineAudioContext` into a stereo `AudioBuffer`, then played. Replay and contrast then play exactly the same sound. Clipping and levels can be inspected, and timing between echoes is exact whatever the output latency.
2. **Mic mode uses the reference click waveform for the echoes**, and the direct-path click is muted because the player hears their own click. The user's recorded waveform is not used in the MVP.
3. **Distance attenuation is ours, not the panner's.** `PannerNode.rolloffFactor = 0`. The panner only spatialises.
4. **A fixed master headroom and a limiter.** Never normalise per scene, because that would change the cues being compared.
5. **Doorways are gaps in wall segments.** They are never objects. Rays through a gap travel up to 8 m, hit nothing and contribute nothing.

---

## 3. Folder structure

```
echo/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── build_spec.md
│   ├── idea_and_strategy.md
│   └── claude_code_prompts.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vercel.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── config.ts                 # ALL constants
│   ├── types.ts                  # shared types (Vec2, Segment, Pole, World, Pose, Hit, EchoVoice, Trial…)
│   ├── engine/
│   │   ├── geometry.ts           # vectors, ray–segment, ray–circle, angle utils
│   │   ├── raycaster.ts          # castRays(world, pose) → Hit[]
│   │   ├── echoBuilder.ts        # hits → EchoVoice[] (≤24)
│   │   ├── collision.ts          # move(pose, step, world) → {pose, collided}
│   │   ├── rng.ts                # mulberry32 seeded RNG
│   │   └── worlds.ts             # world builders (room, corridor, L-corridor, wall-with-gap)
│   ├── audio/
│   │   ├── context.ts            # single AudioContext, unlock on first gesture
│   │   ├── referenceClick.ts     # synthesised click AudioBuffer
│   │   ├── stimulus.ts           # renderStimulus(voices, opts) → AudioBuffer (offline)
│   │   ├── player.ts             # play(buffer), stopAll(), master bus + limiter
│   │   ├── sfx.ts                # bump, correct, wrong, level-up, L/R test tone
│   │   └── micDetector.ts        # getUserMedia + onset detection → onClick()
│   ├── speech/
│   │   ├── narrator.ts           # speechSynthesis queue, cancel, awaitIdle
│   │   └── Announcer.tsx         # aria-live region (screen-reader mode)
│   ├── levels/
│   │   ├── types.ts              # LevelDef, Trial, AnswerResult
│   │   ├── level1Side.ts
│   │   ├── level2Distance.ts
│   │   ├── level3Door.ts
│   │   ├── level4Pole.ts
│   │   ├── level5Escape.ts
│   │   ├── index.ts              # registry
│   │   └── feedback.ts           # explanation strings + contrast worlds
│   ├── state/
│   │   ├── store.ts              # Zustand store + actions
│   │   ├── runner.ts             # phase machine
│   │   └── progress.ts           # trial log, level stats, stretch suggestions
│   ├── input/
│   │   └── keyboard.ts           # scoped key handling
│   └── ui/
│       ├── Onboarding.tsx        # start/unlock, headphone L/R check, narration mode, mic opt-in
│       ├── LevelSelect.tsx
│       ├── BlindView.tsx         # black, huge text, current message
│       ├── ObserverView.tsx      # Canvas 2D top-down rays
│       ├── Controls.tsx          # real buttons for every action
│       ├── Settings.tsx          # stretch, narration mode, click source, volume
│       ├── ProgressPanel.tsx
│       └── styles.css
└── tests/
    ├── geometry.test.ts
    ├── raycaster.test.ts
    ├── echoBuilder.test.ts
    ├── collision.test.ts
    └── levels.test.ts
```

---

## 4. `config.ts` — every constant

```ts
export const SPEED_OF_SOUND = 343;          // m/s
export const RAY_COUNT = 72;                // one every 5°
export const RAY_STEP_DEG = 360 / RAY_COUNT;
export const MAX_RANGE_M = 8;
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
};

export const RENDER_VERSION = 3;            // bump when the echo model changes; logged per trial
```

---

## 5. Engine

### 5.1 Types (`types.ts`)
```ts
type Vec2 = { x: number; y: number };
type Segment = { a: Vec2; b: Vec2; kind: 'wall' };
type Pole = { c: Vec2; r: number; kind: 'pole' };
type World = { segments: Segment[]; poles: Pole[]; exit?: { a: Vec2; b: Vec2 }; bounds: { w: number; h: number } };
type Pose = { p: Vec2; headingDeg: number };            // 0° = +y (forward/north), clockwise positive
type Hit = { rayIndex: number; rayAngleDeg: number; relAzDeg: number; d: number; point: Vec2; cosTheta: number; reflectance: number };
type EchoVoice = { delayS: number; gain: number; cutoffHz: number; azDeg: number; d: number };
```

### 5.2 Ray caster (`raycaster.ts`)
- Rays: `i ∈ [0,72)`, world angle `heading + i·5°`, relative azimuth `relAz = wrap(i·5°)` in (-180, 180].
- For each ray, find the nearest intersection with all segments and pole circles within `MAX_RANGE_M`. No hit → no `Hit` (this is the doorway silence).
- `cosTheta = |dot(rayDir, surfaceNormal)|`. For a pole, the normal is `(hit − c)/r`.
- Pure function, no allocation in the inner loop beyond the result array. Must run under 1 ms for 50 segments.

### 5.3 Echo builder (`echoBuilder.ts`) — deck formulas, verbatim
For each hit, with `d = max(hit.d, MIN_DIST_M)`:
```
delayS   = (2 · d / 343) · stretch
gain     = reflectance · cosTheta · 0.5 / (2 · d) · ECHO_GAIN_SCALE
cutoffHz = 9000 / (1 + d)
azDeg    = relAz
```
Merge:
1. Bin by `(round(azDeg / 15), round(d / 0.25))`.
2. Per bin: `gain = sqrt(Σ g²)`, `d = Σ(g·d)/Σg` (recompute delay and cutoff from the merged d), `az = circular gain-weighted mean`.
3. Sort by gain, descending. Keep the top `MAX_VOICES` (24).

### 5.4 Collision (`collision.ts`)
- `move(pose, ±STEP_M, world)`: the candidate position is invalid if it is closer than `PLAYER_RADIUS_M` to any segment or pole edge. If invalid, the pose stays unchanged and `collided = true`.
- `turn(pose, ±TURN_DEG)` never collides.
- `reachedExit(pose, world)`: player circle intersects the `exit` segment.

### 5.5 Worlds (`worlds.ts`)
- `room(w, h, gaps?: {wall: 'N'|'E'|'S'|'W', center: number, width: number}[])` — four walls, with gaps cut out as missing segment portions.
- `singleWall(side: 'left'|'right', dist)` — one 4 m wall parallel to heading at the given lateral distance, inside an open 16 m box (box walls beyond 8 m return nothing).
- `frontWall(dist)` — one 4 m wall perpendicular to heading, `dist` ahead.
- `corridor(width=2, length=10, poles)`.
- `lCorridor()` — fixed L shape: 2 m wide, 8 m north then 6 m east, exit segment at the end.

---

## 6. Audio

### 6.1 Context (`context.ts`)
- One `AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })`, created lazily and resumed on the first user gesture (the Start button).

### 6.2 Reference click (`referenceClick.ts`)
- 4 ms buffer at 48 kHz: a decaying sinusoid at 3.2 kHz with τ = 0.6 ms, plus 15% white noise. Apply a Hann window to the whole 4 ms, then normalise the peak to 0.8.
- Generate once and cache it.
- Target character: short and sharp, energy mostly in the 2–5 kHz range (Thaler et al. 2017 measured expert clicks at about 3 ms, peaking at 2–4 kHz).

### 6.3 Stimulus render (`stimulus.ts`)
```ts
renderStimulus(voices: EchoVoice[], opts: { includeDirect: boolean }): Promise<AudioBuffer>
```
- `OfflineAudioContext(2, ceil((maxDelay + 0.004 + 0.1) · 48000), 48000)`.
- Direct path, if `includeDirect`: click → Gain(`DIRECT_CLICK_GAIN`) → destination, at t=0.
- Per voice: `BufferSource(click)` → `BiquadFilter{lowpass, cutoff, Q 0.707}` → `Gain(gain)` → `PannerNode{panningModel:'HRTF', distanceModel:'linear', rolloffFactor:0, refDistance:1, maxDistance:10000, position = (sin az, 0, −cos az)}` → destination, started at `voice.delayS`.
- The listener sits at the origin facing −z.
- Return the rendered buffer. Log a warning if `peak > 0.98`; do not rescale.

### 6.4 Player (`player.ts`)
- Master bus: `Gain(MASTER_GAIN)` → `DynamicsCompressor(LIMITER)` → destination.
- `play(buffer)`: stop any currently playing stimulus first, then start a new source. Returns a promise that resolves on `ended`.
- `stopAll()`.

### 6.5 SFX (`sfx.ts`)
All SFX are procedural, with no audio files:
- **bump:** 80 ms, 120 Hz sine with fast decay.
- **correct:** two rising tones, 660 Hz → 880 Hz, 80 ms each.
- **wrong:** a single 330 Hz tone, 150 ms, soft.
- **levelUp:** a 3-note arpeggio.
- **lrTest(side):** 600 ms of 1 kHz panned hard left or right with `StereoPanner(±1)`.

### 6.6 Mic detector (`micDetector.ts`)
- `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. After connecting, read `track.getSettings()` and show which constraints were honoured (in Settings, text only).
- Graph: `MediaStreamSource → BiquadFilter(highpass 1500 Hz) → AnalyserNode(fftSize 1024)`. 1024 rather than 512 because at 48 kHz 512 is 10.7 ms, shorter than a frame; see `MIC.fftSize` in `config.ts`.
- Poll in `requestAnimationFrame`: `peak = max|x|`. Noise floor is an EMA updated only when not triggered. Trigger when `peak > max(MIC.minPeak, floor·MIC.floorMultiplier)` **and** the refractory period of 300 ms has passed.
- On trigger, call `onClick()`, which renders and plays with `includeDirect: false`.
- Ignore triggers while a stimulus or speech is playing, because headphone bleed could re-trigger.
- `stop()` stops all tracks. The mic is off by default. Show a visible indicator while it is on.

---

## 7. Levels

### 7.1 Level contract (`levels/types.ts`)
```ts
type LevelMode = 'choice' | 'aim' | 'navigate';
interface Trial { seed: number; world: World; start: Pose; answer: string | number; meta?: Record<string, unknown> }
interface AnswerResult { correct: boolean; explanation: string; contrast?: { label: string; world: World }[] }
interface LevelDef {
  id: 1 | 2 | 3 | 4 | 5;
  title: string; skill: string; intro: string;    // intro is spoken
  mode: LevelMode;
  trials: number;                                  // number of trials per run
  passRule: (results: AnswerResult[], elapsedS: number) => boolean;
  makeTrial: (rng: () => number, index: number) => Trial;   // must balance answers across a run
  answerKeys: Record<string, string>;              // key → answer value
  check: (trial: Trial, answer: string | number | null, pose: Pose, elapsedS: number) => AnswerResult;
}
```

### 7.2 The five levels (pass rules exactly as submitted)

| # | Title | Skill | World | Action | Trials | Pass |
|---|---|---|---|---|---|---|
| 1 | Which side? | Direction | `singleWall(left/right, 1.5 m)`, 5 left and 5 right, shuffled | Click (Space) as often as wanted, answer ← / → | 10 | ≥ 8/10 |
| 2 | Near or far? | Distance | `frontWall(1.0 m)` or `frontWall(3.0 m)`, balanced 5/5 | Click, answer 1 (near) / 2 (far) | 10 | ≥ 8/10 |
| 3 | Find the door | Gaps are silent | `room(6×6)`, a 1.0 m gap at a random wall position (not within 0.75 m of a corner); start heading random, multiple of 15° | A/D to turn, Space to click, Enter when facing the door | 5 | Each trial correct if \|heading − bearing to gap centre\| ≤ 20°. Pass at ≥ 4/5 |
| 4 | The pole | Small objects | `corridor(2 × 10)` with 1 pole at random x ∈ [−0.5, 0.5] m, y ∈ [3, 7] m | W/S walk, A/D turn, Space click; reach the far end | 3 | A run passes if the end is reached with 0 collisions. Pass at ≥ 2/3 |
| 5 | Escape | Combined | `lCorridor()` | Walk to the exit | 1 | Exit reached in < 90 s. Collisions are counted but don't fail the run |

**Collisions** play `bump`, increment a counter and announce "Bump. N." There are no fail screens.

### 7.3 Feedback (`feedback.ts`) — the "instructor"
After every answered trial (Levels 1–3), or after every collision and the run end (Levels 4–5):
1. Play the `correct`/`wrong` SFX.
2. Speak the result and **what cue to listen for**:
   - L1 wrong: "Not quite. The wall was on your left. The echo arrives a little earlier and louder in your left ear."
   - L1 right: "Correct, left. That slightly earlier, louder echo on one side is the cue."
   - L2: "The wall was far, three metres. Far echoes come later and sound duller."
   - L3: "The door was 40 degrees to your right. Listen for the side where the room goes quiet."
   - L4 bump: "Bump. The pole was just ahead, slightly left. A pole gives a small, short echo, much weaker than a wall."
3. Offer these actions (buttons and keys):
   - **R — replay** the last stimulus.
   - **C — contrast:** speak "Without", play the contrast world, pause 400 ms, speak "With", play the trial world. Contrast worlds:
     - L1: no wall vs wall.
     - L2: near vs far.
     - L3: the same room with no gap vs with the gap, from the same pose.
     - L4: the corridor without the pole vs with it.
   - **N / Enter — next.**
4. Count replays and contrasts in the trial log.

### 7.4 Training wheels (stretch)
- Global stretch setting with steps `[8, 6, 4, 3, 2, 1.5, 1]`. Default 4.
- Store passes per `(level, stretch)`. After `3` consecutive passes of a level at the current stretch, speak: "You passed three times in a row. Try echoes closer to real speed, at 3 times? Press Y for yes." The new value is the next lower step.
- Stretch is shown in the blind view ("Echo speed: 4 times slower") and in Settings.

---

## 8. State and flow

### 8.1 Phase machine (`state/runner.ts`)
```
onboarding → levelSelect → intro → ready ⇄ (clicking / moving) → answered → feedback → (next trial → ready) | summary → levelSelect
```
- `intro`: speak the level intro. Space is disabled until speech ends; the player presses Enter to begin.
- `ready`: Space/mic click renders and plays the stimulus from the current pose. Answer keys are enabled only after ≥ 1 click.
- `answered` → `feedback`: as in 7.3.
- `summary`: speak "Level 1. 8 out of 10. Previously 6 out of 10. Passed." Show the same text.

### 8.2 Store (`state/store.ts`)
```ts
{
  phase, levelId, trialIndex, trial, pose, results: AnswerResult[], collisions, startedAt,
  lastStimulus: AudioBuffer | null, lastVoices: EchoVoice[], lastHits: Hit[],
  settings: { stretch, narration: 'voice' | 'screenreader', clickSource: 'key' | 'mic', volume, observer: boolean },
  micOn: boolean,
  message: string             // current text shown in BlindView and sent to narration/announcer
}
```

### 8.3 Progress (`state/progress.ts`)
- `localStorage['echo.trials.v1']` holds an array of `{ ts, levelId, trialIndex, seed, stretch, clickSource, renderVersion, answer, correct, replays, contrasts, collisions, elapsedS }`.
- `localStorage['echo.settings.v1']`.
- `levelStats(levelId)` returns `{ lastScore, prevScore, bestScore, passesInRowAtStretch }`.
- A "Reset progress" button with a confirm step (a button inside the panel, not `window.confirm`).

---

## 9. UI and accessibility

### 9.1 Views
- **BlindView:** full-screen black (`#000`) with white text at ≥ 48 px. Shows the current `message`, the level, the trial number and the echo speed. Nothing important is visual-only.
- **ObserverView:** Canvas 2D, top-down at 60 px/m and centred on the room.
  - Walls are drawn as 4 px light lines and poles as filled circles.
  - The player is a triangle pointing along the heading.
  - On each click, animate the 72 rays outward for 400 ms. Rays that hit flash their hit point (alpha ∝ gain). Rays that escape fade out dim, which visibly shows the doorway gap.
  - In Levels 1–3 the answer is hidden behind a "Reveal" toggle until the trial is answered.
- **Layout:** `observer: false` shows the BlindView full-screen. `observer: true` shows a split: BlindView on the left 40%, ObserverView on the right 60%. Toggle with V or the button.

### 9.2 Controls
Every action has a real `<button>` with a visible label and a key hint: Click, ←, →, Near, Far, Turn left, Turn right, Step forward, Step back, Answer/Enter, Replay, Contrast, Next, Settings, Observer view. Buttons appear only when valid in the current phase.

### 9.3 Keyboard (`input/keyboard.ts`)
- Listener attached to the practice container (`role="application"`, `aria-label="Echo practice area. Press H for help."`, `tabIndex=0`), **not** to `window`. Keys work only while it is focused.
- Ignore `event.repeat`.
- During setup, any key starts; Y/N choose screen reader/voice, left/right arrows answer the headphone check, Enter or N skips the mic, M enables it, and Enter finishes the mic test. Focused buttons retain native Space/Enter activation after Start; the default focused choices are voice and skipping the mic.
- In level select, 1–5 start the corresponding level and H repeats the spoken list of titles and keys. In ready, 1/2 still answer near/far.
- Map: Space click · ← → · 1 2 · A D turn · W S step · Enter answer/begin/next · R replay · C contrast · Y accept stretch · V observer · H help (speaks the key map) · Esc to level select.

### 9.4 Narration modes
- **voice** (default): `narrator.speak(text)` through `speechSynthesis` with rate 1.05 and an English voice. `aria-live` stays silent except for errors.
- **screenreader:** no `speechSynthesis`. Messages go to an `aria-live="polite"` region (`Announcer`). The screen reader speaks them.
- Never both at once.
- **Before any stimulus plays:** `narrator.cancel()` and await idle. In screen-reader mode the stimulus only plays on an explicit Space press, so the player controls timing.
- Messages are announced only at phase changes, results and errors — not on every state change.
- In voice mode, keyboard focus on a button speaks its label and key hint, replacing earlier focus speech. Screen-reader mode and an actively playing stimulus suppress these focus announcements.

### 9.5 Onboarding (`Onboarding.tsx`)
1. A full-viewport real button says "Press any key or tap anywhere to start Echo." Any first key/pointer press on the practice container starts setup and creates/resumes the AudioContext. No speech is expected before a gesture.
2. "Welcome to Echo. Do you use a screen reader? Press Y for yes or N for no." Yes/No buttons set the narration mode; "No, speak to me" has autofocus so an accidental Enter keeps voice narration. This question precedes the headphone check (see Decisions log).
3. Headphone check: "Press left arrow when you hear the tone." Play `lrTest('left')`, then the same for right. If wrong twice, say "Your headphones may be reversed or not stereo." Allow continuing anyway.
4. Mic is optional: "Use your own tongue click? Press Enter or N to skip and use the Space key. Press M to use the microphone. You can turn this on later in Settings." Skip is the default. If enabled: permission prompt, then "Click your tongue three times. Press Enter when done." Show and speak the detection count. On permission denied: "Microphone blocked. Using the Space key." and continue.
5. Go to level select and speak each level's title with its number shortcut, followed by "Press H for help."
6. Store completion so returning users skip onboarding (there is a "Redo setup" button in Settings). Their first key/pointer gesture unlocks audio and speaks the level-select prompt.

### 9.6 Visual design
- Black background, white text, one accent colour (`#7CF5FF`) for rays and focus rings.
- Focus ring 3 px; buttons at least 56 px tall.
- Font: system UI stack (no web fonts, so it works offline).

---

## 10. Testing

### 10.1 Unit tests (Vitest) — required before the hour-16 merge
- **geometry:** ray–segment hit/miss/parallel; ray–circle hit/miss/tangent.
- **raycaster:**
  - A room with no gaps gives 72 hits.
  - A room with a 1 m gap ahead and the player 3 m away gives zero hits for the rays inside the gap cone.
  - Range limit: a wall at 9 m gives 0 hits.
- **echoBuilder:**
  - At d = 1 m and stretch 1, delay = 5.831 ms ± 0.01.
  - At stretch 4, delay is ×4.
  - Gain at d=0.5, r=0.9, cosθ=1 is 0.45 · `ECHO_GAIN_SCALE`.
  - Cutoff at d=1 is 4500 Hz.
  - The voice count is ≤ 24 for a cluttered room.
- **collision:** walking into a wall reports a collision and the pose is unchanged; turning never collides.
- **levels:**
  - Each choice level's `makeTrial` over one run yields balanced answers.
  - L3: the door bearing is computed correctly for all four walls.

### 10.2 Manual tests
- **Hour-10 blindfold gate:** 2 teammates do 10 trials of Level 1 at stretch 4. **Both must score ≥ 8/10.** If not, tune `ECHO_GAIN_SCALE`, `DIRECT_CLICK_GAIN` and the click before building anything else. Record the result in `CLAUDE.md` § Decisions log.
- **Screen-reader pass:** Chrome + NVDA (Windows). Complete onboarding and Level 1 without looking. Done at hours 20 and 28.
- **Mic pass:** in a quiet room with wired headphones, 10 tongue clicks should give ≥ 8 detections and 0 false triggers in 30 s of silence.
- **Clip check:** play Level 3 from a corner facing a wall. The console must show no `peak > 0.98` warnings.

---

## 11. Build segments and task lists

Owners: **A** Audio engineer · **B** Geometry and levels · **C** Visuals and UX · **D** Integration and pitch.

### Segment 0 — Scaffold and contracts (0–2 h) · D (all review)
- [ ] `npm create vite@latest echo -- --template react-ts`; strict TS; add zustand and vitest.
- [ ] Create the full folder structure from §3 with stub exports.
- [ ] Write `config.ts` (§4) and `types.ts` (§5.1) in full. These are the shared contract.
- [ ] Add `vercel.json` (SPA rewrite) and deploy the empty app to Vercel. Share the URL.
- [ ] Commit `CLAUDE.md`, `README.md` and `docs/`.

### Segment 1 — First HRTF echo (2–6 h) · A
- [ ] `context.ts` with unlock on gesture.
- [ ] `referenceClick.ts` (§6.2).
- [ ] `stimulus.ts` offline render with HRTF panner and `rolloffFactor 0` (§6.3).
- [ ] `player.ts` with master bus and limiter (§6.4).
- [ ] A dev-only page `/?dev=audio` with sliders for d (0.3–8 m), az (−180–180°) and stretch (1–8), plus a Play button. Verify by ear that left/right and near/far are obvious at stretch 4.
- [ ] `sfx.ts`.

### Segment 2 — Ray caster and echo builder (2–10 h) · B
- [ ] `geometry.ts` and its tests.
- [ ] `worlds.ts` (all builders, including gap cutting).
- [ ] `raycaster.ts` and its tests.
- [ ] `echoBuilder.ts` with the deck formulas and merge, plus tests.
- [ ] `collision.ts` and its tests.
- [ ] Wire `castRays → buildEchoes → renderStimulus → play` on the dev page with a fixed room.

### Segment 3 — Observer view and blind view shell (4–12 h) · C
- [ ] `ObserverView.tsx`: draw world, player and ray animation from `lastHits` (§9.1).
- [ ] `BlindView.tsx` and the split layout toggle.
- [ ] `Controls.tsx` with phase-aware buttons.
- [ ] `styles.css` (§9.6).

### Segment 4 — Level runner, Levels 1–3 and feedback (8–16 h) · B + C
- [ ] `levels/types.ts`, `level1Side`, `level2Distance`, `level3Door`, `index.ts`.
- [ ] `state/store.ts` and `state/runner.ts` (§8).
- [ ] `input/keyboard.ts` (§9.3).
- [ ] `speech/narrator.ts` and `Announcer.tsx` (§9.4).
- [ ] `feedback.ts`: explanations plus replay and contrast (§7.3).
- [ ] `LevelSelect.tsx`.
- [ ] **Hour-10 gate** (§10.2) on Level 1. Log the result.

### Segment 5 — Movement, Levels 4–5, mic, training wheels (16–24 h) · A + B
- [ ] Movement through W/S/A/D with collisions, `bump` and announcements.
- [ ] `level4Pole`, `level5Escape` (timer, exit detection).
- [ ] `micDetector.ts` (§6.6), plus mic mode in the store and Settings.
- [ ] Stretch suggestions (§7.4).
- [ ] Footstep tick on each step (a 30 ms filtered noise burst) so movement is audible.

### Segment 6 — Accessibility, onboarding, progress, settings (16–24 h) · C + D
- [ ] `Onboarding.tsx` (§9.5).
- [ ] `Settings.tsx` (stretch, narration mode, click source, volume, mic constraint report, redo setup, reset progress).
- [ ] `progress.ts` and `ProgressPanel.tsx` (§8.3).
- [ ] NVDA pass #1 at hour 20; fix everything found.

### Segment 7 — Tuning and blind tests (24–29 h) · all
- [ ] Blindfold runs of all 5 levels by every teammate. Log scores.
- [ ] Tune `ECHO_GAIN_SCALE`, voice merge bins and the L3 gap width if it is undetectable. Log every change.
- [ ] NVDA pass #2. Mic pass. Clip check.
- [ ] **Feature freeze at hour 29.** From here on, bug fixes only.

### Segment 8 — Ship and pitch (29–36 h) · D (lead), all
- [ ] Production deploy. Test the offline reload (load once, disconnect, reload).
- [ ] Finalise `README.md` and `docs/idea_and_strategy.md`.
- [ ] Record a 2–3 min demo video (split view, real blindfolded run of L1 and L3).
- [ ] Update slides (the wording fixes in `idea_and_strategy.md` §9).
- [ ] Rehearse the pitch 3 times, with a backup video offline on a laptop.

### Cut order if behind
1. Footstep tick
2. Level 5 timer polish
3. Progress panel (keep the spoken summary)
4. Mic mode (keep the Space click)
5. Level 4

**Never cut:** Levels 1–3, feedback with replay and contrast, the blind view, real buttons, the narration modes and the limiter.

---

## 12. Definition of done (whole project)
- [ ] Deployed URL loads and works offline after the first load.
- [ ] A blindfolded new user completes onboarding and Level 1 using keyboard and voice only.
- [ ] All 5 levels are playable. Pass rules match §7.2.
- [ ] Every answer gives an explanation, replay and contrast.
- [ ] Stretch 8×–1× works, with suggestions after 3 passes.
- [ ] The observer view shows rays and gap silence.
- [ ] Unit tests pass (`npm test`). `npm run build` has 0 TS errors.
- [ ] No console errors during a full run. No clip warnings.
- [ ] README, idea_and_strategy and the demo video are done.

---

## 13. Mobile (Android)

Lifts the "no mobile" and dependency bans. The work was built on the `mobile` branch and is now merged into `main`; `mobile` is kept as a branch.

**Principle: teach, don't replace.** Echo trains the ear. Nothing on the phone should become a crutch, so every aid is guess-first and fades with skill.

### 13.1 Packaging
- Capacitor wraps the Vite build (`dist/`) as an Android app. Allowed new packages: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`. No other plugins; native code is a small in-repo Java plugin (`android/app/src/main/java/.../EchoNativePlugin.java`).
- The web build must keep working unchanged in a browser. Native-only features sit behind `src/native/` and no-op on the web.

### 13.2 Touch gestures (`input/gestures.ts`)
Active only when no screen reader is on. TalkBack takes over raw touch, and the real buttons stay the way in.
- 1 tap: Click · 2 taps: Replay · 3 taps: Contrast
- Swipe left / right: Left / Right, or Turn left / Turn right where those are valid
- Swipe up / down: Far / Near, or Step forward / Step back where those are valid
- Long press: Answer / Next · Two-finger tap: Help · Three-finger tap: Level list
- A single tap fires at once when no multi-tap action is valid, so Click has no delay.
- Every recognised gesture gives a 20 ms vibration tick, so the user knows it registered.

### 13.3 Volume keys
Native only. Practising: Volume up: Click · Volume down: Replay (or Next in feedback). **Level list (menu scanning):** Volume down moves to the next option, highlights it and speaks it with its place ("2 of 12"); Volume up chooses the highlighted option, or explains the keys if none is chosen yet. A Settings switch gives the keys back to the system volume. Default: keys act as actions when no screen reader is on, system volume when one is.

### 13.4 Morse feedback (`speech/morse.ts`, `audio/morsePlayer.ts`)
Settings `Morse`: off · vibration · sound. It is added to the narration, never a replacement, and never plays over a stimulus or speech. Codes: pass `OK`, miss `TRY`, bump `B`, level start the level digit. Unit 120 ms; dash 3, gap 1, letter gap 3, word gap 7.

### 13.5 Screen reader (`native/screenReader.ts`)
Native: TalkBack touch-exploration state is read on launch, on resume and on change. On → narration `screenreader`, our speech is cancelled and not used; the user's choice is kept and restored when it goes off. Web: the onboarding question stays.

### 13.6 Real-room ranging and direction (`engine/ranging.ts`, `audio/ranger.ts`, `engine/roomDirection.ts`, `input/compass.ts`, `speech/roomText.ts`)
Replaces camera depth (a camera sees nothing in the dark and depth needs ARCore/ML). The phone plays a 4 ms linear chirp (2–9 kHz) and records with echo cancellation, noise suppression and AGC requested off. A matched filter finds the direct speaker-to-microphone path, which anchors time zero, and the first later peak that clears both the noise floor and the chirp's sidelobe floor; distance = 343 × Δt / 2. Five pings, median. Works in total darkness. Estimate range 0.3–5 m; this is a practice aid, not a navigation aid.
- Flow: the user pings, **guesses first** (Far/Near = ±0.5 m, Answer to confirm), then Echo reveals the measured distance and the difference.
- Fade: after three guesses in a row within 0.5 m, Echo says only "Close" or "Off" unless Replay is pressed.
- **Direction pass (22 November 2026):** at each measured ping the phone's heading is read from `deviceorientationabsolute` (or `deviceorientation` where that is all that exists — never both, their zero points differ) and stored with the distance. Turns between measurements are spoken, and Replay names the nearest reading by the facing it was taken with. The heading comes from the phone's **top edge**, so it needs the phone fairly flat (`HEADING.minHorizontal`), and a sample older than `HEADING.staleMs` is refused rather than guessed. A phone with no sensor, or a stale sample, hears nothing about direction — exactly the behaviour before the pass. **One mono microphone cannot say which way an echo came from, so no spoken line ever does; every direction line describes the way the phone was held.**
- **Guards, so a bad room is called bad instead of guessed at:**
  - A take holding less than 90% of the planned samples is discarded (`RANGING.minFilledFraction`). The browser delivers recording buffers on the main thread, and a dropped buffer silently shortens every distance in the take.
  - If the pings' distances span more than 80 cm (`RANGING.agreeSpreadM`), the reveal says the distance is rough (`pingsDisagree` in `engine/ranging.ts`) instead of presenting the median as a measurement.
  - If the phone still reports echo cancellation, noise suppression or AGC (`audioFiltered()`), Echo says once per visit that its distances may be wrong. Web Audio can only request those off.
- **Places (echo-signature recognition):** after two facings at one spot, *Save this place* stores the spot's readings with headings relative to its first facing, in `localStorage` under `echo.places.v1` (at most `PLACES.maxPlaces`). Coming back, two pings are matched rotation-invariantly against the saved signatures (`matchPlaces`, `engine/placeMap.ts`); a place is named only when at least `PLACES.matchShare` of the fresh readings fit it and no second place fits within `PLACES.tieShare`, and otherwise the learner hears that the places sound too alike. **This is recognition of a spot, not a position:** there is no GPS, no dead reckoning, no floor plan, and no distance or bearing between two places. Ten steps away, Echo has no idea it is the same room.
- **Marks:** *Mark what is here* offers Wall, Doorway or opening, Step or drop and Obstacle. A mark stores its kind with the facing and the distance measured at that moment (at most `PLACES.maxMarksPerPlace` per place, `PLACES.markHeadingDeg` to count as the same facing). Replay reads back the marks facing the current way and reports a mark whose distance the fresh measurement contradicts (`PLACES.contradictionM`) — reporting the measurement, never why it changed. Places need a heading, so a phone with no sensor records none of this.
- **Accuracy is unverified on a device.** Synthetic tests place a wall within 5 cm. On a phone the reading is expected to be a few centimetres **short**, because time zero is the speaker-to-microphone path rather than the speaker, and soft, oblique or cluttered surfaces can return an echo too weak to pass the floor — that is the "I could not find a wall" case. Never describe these numbers as clinically accurate or as a tape measure.

### 13.7 Teaching track (`levels/lessons.ts`, `state/lessonRunner.ts`, `audio/clickCoach.ts`)
Echo must teach the technique, not only test it. Level select shows **Learn** (six lessons) above **Practise** (the five levels).
- A lesson is pages of short spoken text and engine-rendered A/B examples. Continue moves on, Hear again repeats the page, the last page offers "Practise this skill" which opens the matching level.
- Lessons: 1 Make your click · 2 Which side is the wall (→ L1) · 3 Near and far (→ L2) · 4 Doorways are silence (→ L3) · 5 Poles and moving (→ L4) · 6 Practise in a real room.
- **Click coach (Lesson 1):** the learner makes a palatal tongue click; the mic hears it and Echo judges each click on loudness, length and brightness (`engine/clickQuality.ts`). Verdicts: good (a tone, no speech), quiet, loud, long, dull, each with one concrete fix. Five good clicks end the exercise. No mic: the lesson says so and lets the learner practise unmonitored. Thresholds are first guesses (`CLICK_COACH`) to be tuned on a real phone.
- Lesson 6 is the bridge to real rooms: arm's length from a wall, step back, doorway listening, and always with a cane or a friend. Echo is stated to be practice, never a navigation aid.

### 13.8 Touch-and-hold to hear (`input/readAloud.ts`)
With our own voice on and no screen reader, holding a finger on a button, card, chip, heading or the message for 0.5 s reads it aloud and does **not** press it; a quick tap still presses. This lets a blind user feel their way round the screen. With TalkBack on it stands down, because the phone already reads what is touched. Gestures ignore touches that begin on these elements, so a read never also fires an action.

### 13.9 Feel the answer (`speech/hapticPatterns.ts`, `state/haptics.ts`)
Idea from V-Braille (Jayant et al., ASSETS 2010): distinct vibration patterns can be told apart by touch after minutes of familiarization. Settings `Feel the answer` (off by default) vibrates once per answer and once per result: left one short buzz · right two short · near one tick · far one long · pass three growing buzzes · miss long then short · bump three even buzzes. Patterns live in `config.ts` (`HAPTIC`), must all differ, and stay under 700 ms. Independent of Morse, which spells words; this only confirms.

Note: on Android a long press can make the browser cancel the pointer. A cancel without movement must not abort a pending read, and a cancelled touch must not leave the click guard armed (it would swallow the next tap).

### 13.10 Native speech and key capture (found on a real phone)
- Android WebView has **no** `speechSynthesis`, so the web narrator was silent in the app. On native, `speech/narrator.ts` speaks through the system text-to-speech engine via `EchoNativePlugin.speak` / `stopSpeaking`, with a `speechEnd` event per utterance. The manifest needs a `<queries>` entry for `TTS_SERVICE` on Android 11+.
- A captured volume key must be swallowed on **key-up** as well as key-down, or the system still changes the volume and shows its slider.
- Long spoken instructions must not be shown as the on-screen message (`say(text, { display })`), or the level list is pushed off the screen.

### 13.11 Back (`input/back.ts`)
One meaning of Back everywhere: the on-screen **Back** button (top left on every screen except the level list), the phone's back button and the back swipe. Back closes Settings if open; otherwise goes from any lesson, level or real-room check to the level list; on the level list (or first-run setup) it says "Press back again to close Echo" and closes only on a second press within 2.5 s. Android's back is handed to JS by `EchoNativePlugin` (`backPressed`), so it can never silently close the app. Verified on a phone: Back from a lesson returns to the level list.

Not yet verified on a phone: the double-press exit at the top, the new text sizes on the real screen, and the two-column button grid.

Current fix and test status, what still needs a phone check, and known open issues: `docs/mobile_status.md`.

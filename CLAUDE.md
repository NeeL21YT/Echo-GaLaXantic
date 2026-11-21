# CLAUDE.md — rules for Claude Code on Echo

You are building **Echo**, a browser-based echolocation trainer for blind people, for the Orbix 48-hour hackathon. The team is GaLaXantic. You write the code. Follow these rules for the whole build.

## Read first, every session
1. `docs/build_spec.md` is the source of truth for architecture, formulas, levels, UI, tests and segments.
2. `docs/idea_and_strategy.md` is the why and the pitch. Only read it when you are writing user-facing text.
3. This file.

If a request conflicts with `build_spec.md`, stop and say so. Do not silently pick one.

## Stack (fixed — do not change)
- React 18 + Vite + TypeScript with `strict: true`
- Web Audio API, Canvas 2D, Web Speech API
- Zustand for state; Vitest for tests
- Deploy: Vercel, static

**Do not add dependencies** beyond `react`, `react-dom`, `zustand`, `vitest`, `@vitejs/plugin-react` and `typescript`. On the `mobile` branch only, `@capacitor/core`, `@capacitor/cli` and `@capacitor/android` are also allowed (build_spec §13). If you believe one is needed, ask first and give the reason. This rules out Three.js, Tone.js, Howler, UI kits, CSS frameworks, chart libraries, analytics and web fonts.

## Code rules
- **All numbers live in `src/config.ts`.** No magic numbers in engine, audio or level code. If you need a new constant, add it to `config.ts` with a comment.
- **Shared types live in `src/types.ts`** and `src/levels/types.ts`. Don't redefine them locally.
- The engine (`src/engine/*`) is **pure**: no DOM, no audio, no store imports. Same input, same output.
- Audio code never imports React.
- One responsibility per file, matching the folder structure in `build_spec.md` §3. Don't create new top-level folders.
- Functions over classes, except where an API needs state (the player, mic detector, narrator). Those are module singletons with explicit `init`/`dispose`.
- No `any`. No `// @ts-ignore`. No disabled lint rules.
- Names are plain and specific: `castRays`, `buildEchoes`, `renderStimulus`. Not `handleStuff` or `utils2`.
- Comments explain *why*, not what. No banner comments and no commented-out code.

## Echo model rules (do not drift)
- The formulas are exactly:
  - `delay = 2d/343 × stretch`
  - `gain = r × cosθ × 0.5/(2d) × ECHO_GAIN_SCALE`
  - `cutoff = 9000/(1+d)`
  - 72 rays, 8 m range, ≤24 merged voices.
- A doorway is a **gap in wall segments**. Never model a door as an object that emits or reflects sound.
- `PannerNode`: `panningModel 'HRTF'`, `distanceModel 'linear'`, `rolloffFactor 0`. Distance loudness comes only from our gain formula.
- Render every stimulus with `OfflineAudioContext`, then play the buffer. Replay and contrast reuse buffers or re-render identical inputs.
- Never normalise a stimulus per scene. Fixed master gain plus limiter only. If a rendered peak is > 0.98, `console.warn` with the scene seed.
- In mic mode the direct click is muted (`includeDirect: false`), and the echoes use the reference click waveform.
- Changing any formula or tunable means bumping `RENDER_VERSION` and adding a line to the Decisions log below.

## Accessibility rules (non-negotiable)
- Every action is a real `<button>` with a text label. Keys are shortcuts on top of the buttons, never the only way.
- Keyboard listeners attach to the practice container (`role="application"`), not to `window`. Ignore `event.repeat`.
- Narration mode is either `voice` (speechSynthesis) or `screenreader` (aria-live). Never both.
- Call `narrator.cancel()` and wait for idle before playing any stimulus. Never play a stimulus while speech is playing.
- Nothing is conveyed only visually. If the observer view shows it, a message says it too.
- Visible 3 px focus rings. Buttons are at least 56 px tall. Text in the blind view is at least 48 px.
- Don't use `alert`, `confirm` or `prompt`.

## User-facing text rules
- Short, concrete, spoken-friendly sentences. Write numbers as a voice would say them ("three metres", "8 out of 10").
- Feedback always names the cue to listen for (see `build_spec.md` §7.3). It never only says "wrong".
- No harsh failure language. Collisions are "Bump."
- Never claim the app is clinically proven, accurate to real acoustics, or a navigation aid.

## Testing rules
- Engine changes need passing Vitest tests (`npm test`). Add tests for new engine functions.
- Before reporting a task done, run `npm run build` (0 TS errors) and `npm test`.
- For audio and UX tasks, which can't be unit-tested, list the exact manual check the human should do (what to press, what they should hear).

## Workflow rules
- Work only on the segment or task you were given. Don't start the next segment.
- Before writing code, state in 3–6 bullets the files you will touch and what each change is.
- After finishing, report:
  1. Files changed
  2. What works now
  3. Test results
  4. Manual check for the human
  5. Anything left undone or uncertain
- Keep it short.
- If something in the spec is ambiguous, choose the simplest option, implement it, and flag it in the report. Don't stall.
- Don't refactor code outside the task's scope. If you see a bug elsewhere, report it; don't fix it silently.
- Commit messages: `seg<N>: <what>`, e.g. `seg2: ray caster with gap test`.

## Out of scope — refuse and point to the spec
3D geometry, noise ladder, material recognition, a personalised recorded-click waveform, adaptive threshold estimation, accounts, backends, ML, head-tracking, floor-plan import, analytics, camera or depth-sensor ranging. (Mobile layout and the Android app are in scope on the `mobile` branch, see build_spec §13.)

## Feature freeze
After hour 29 (see `build_spec.md` §11, Segment 7), only fix bugs. Decline new features and say "feature freeze".

## Decisions log
Append one line per change: `YYYY-MM-DD HH:MM — what changed — why — RENDER_VERSION`.

- 2026-11-21 — Initial spec. Deck formulas adopted. Doorway = gap. Offline-rendered stimuli. rolloffFactor 0. — RENDER_VERSION 1
- 2026-11-21 20:30 — Deps: react/react-dom/@types pinned to 18; `vite` and `@types/react(-dom)` kept as build-time necessities; template eslint packages not installed — the allowlist omitted what the Vite template needs — RENDER_VERSION 1
- 2026-11-21 20:30 — Offline: hand-written `public/sw.js` (no plugin), registered in prod only; Cache Storage used for app files only — §1/§12 require offline reload and no dependency may be added — RENDER_VERSION 1
- 2026-11-21 20:30 — Range: a hit counts only if `HIT_EPSILON_M < d < MAX_RANGE_M` (strict), so the 16 m box walls at exactly 8 m stay silent — §5.5 vs §5.2 boundary — RENDER_VERSION 1
- 2026-11-21 20:30 — Coordinates: worlds centred on the origin, dir = (sin θ, cos θ), bearing = atan2(dx, dy); Canvas flips y only in ObserverView — §5.1 left origin and gap offsets unspecified — RENDER_VERSION 1
- 2026-11-21 20:30 — Gaps: intervals clipped, sorted and unioned per wall before cutting; the L3 "0.75 m from a corner" applies to the gap edge — avoids negative or duplicate segments — RENDER_VERSION 1
- 2026-11-21 20:30 — Merge: azimuth bins are circular (mod 360), zero-gain hits are dropped, weighted means use the original gains — avoids a ±180° split and ÷0 — RENDER_VERSION 1
- 2026-11-21 20:30 — Collision: the player circle is swept along the step (not an endpoint-only check) — a 0.5 m step could tunnel through a thin wall — RENDER_VERSION 1
- 2026-11-21 20:30 — Render: empty voices render direct click/silence (maxDelay defaults to 0); panner azimuth converted to radians — L1 "no wall" contrast — RENDER_VERSION 1
- 2026-11-21 20:30 — Contrast labels: L2 says "Near … Far", L1/L3/L4 "Without … With"; L5 has no contrast; a bump in L4/L5 keeps the run going — §7.3 labels didn't fit L2 — RENDER_VERSION 1
- 2026-11-21 20:30 — Keys: a focused `<button>` keeps its native Space/Enter and the container ignores it; `N` = next added to the map — avoids double actions — RENDER_VERSION 1
- 2026-11-21 20:30 — Trial log adds `runId`; each entry is finalised when its feedback ends so replay/contrast counts are complete — §8.3 couldn't separate runs — RENDER_VERSION 1
- 2026-11-21 20:30 — Click constants (`CLICK`), `HIT_EPSILON_M` and `CLIP_WARN_PEAK` added to config.ts — no magic numbers outside config — RENDER_VERSION 1
- 2026-11-21 21:40 — Echo builder: hits carry `kind`; pole and wall echoes use separate merge bins and pole voices are reserved before the strongest walls fill the 24-voice cap — in the L4 corridor the pole echo (gain 0.130) ranked 25th and was silently dropped; the cap is a render budget, not acoustics. Formulas unchanged — RENDER_VERSION 2
- 2026-11-21 21:40 — Mic: analyser `fftSize` 1024 instead of 512 — 512 samples (10.7 ms) is shorter than one animation frame, so a 3 ms click could fall between polls — RENDER_VERSION 2
- 2026-11-21 21:40 — Onboarding asks "Do you use a screen reader?" right after Start, before the headphone check — otherwise speechSynthesis talks over NVDA for the whole check — RENDER_VERSION 2
- 2026-11-21 21:40 — Progress: run summaries stored in `echo.runs.v1` next to the trial log; every session starts on the Space key (the mic needs a fresh permission grant) — score history and pass streaks without rebuilding runs from trials — RENDER_VERSION 2
- 2026-11-21 21:40 — Screen-reader mode contrast: each label is announced, then a fixed 1.5 s gap before its sound — `speechSynthesis` can't observe when NVDA finishes — RENDER_VERSION 2
- 2026-11-21 21:50 — Stimulus: fixed `STIMULUS_GAIN` 0.18 on one GainNode before the offline destination (direct click and echoes alike; no per-scene normalising, formulas and MASTER_GAIN unchanged) — coherent echo sums near corners broke the §10.2 clip limit: worst peak over all reachable poses was L3 2.15, L4/L5 4.67 (L1 0.400, L2 0.642); now L1 0.072, L2 0.116, L3 0.387, L4/L5 0.840; output is about 15 dB quieter at normal poses, so players may need the volume control — RENDER_VERSION 3
- 2026-11-21 — `mobile` branch opened: Android APK via Capacitor, touch gestures, volume keys, Morse feedback, TalkBack detection, speaker-chirp ranging. Spec §1 "desktop only", the mobile/dependency bans and the hour-29 freeze are lifted for this branch only; `main` (the deployed hackathon build) is untouched — owner chose "branch + amend spec", Capacitor, and chirp ranging over camera depth — RENDER_VERSION 3
- 2026-11-21 21:49 — Start is a full-viewport button; any non-repeated key or pointer press on the practice container starts setup — users without a screen reader need a discoverable first gesture before browsers permit sound — RENDER_VERSION 3
- 2026-11-21 21:49 — Returning users unlock audio and hear the level-select prompt on their first key/pointer gesture, once across both gesture types — skipping setup must not leave voice users in silence — RENDER_VERSION 3
- 2026-11-21 21:49 — Screen-reader setup uses Y/N, speaks those keys, and autofocuses No, speak to me — accidental Enter must preserve voice narration — RENDER_VERSION 3
- 2026-11-21 21:49 — Mic setup uses Enter/N to skip, M to enable, and Enter to finish testing, with spoken and visible key hints — optional microphone setup must work by keyboard and voice alone; native focused-button activation remains available — RENDER_VERSION 3
- 2026-11-21 21:49 — Level select uses 1–5 and speaks a prompt built from LEVELS titles on entry and H or its Help button; ready keeps 1/2 for near/far — users need discoverable, phase-scoped level shortcuts with real buttons — RENDER_VERSION 3
- 2026-11-21 21:49 — Voice-mode focusin on focus-visible buttons speaks the label and key hint, replacing earlier speech; screen-reader mode and playing stimuli suppress it — keyboard users without a screen reader must hear the available buttons without overlapping stimuli — RENDER_VERSION 3
- 2026-11-21 21:49 — Setup prompts run after autofocus, and stimulus/contrast playback rechecks speech idle after rendering — focus labels must neither replace setup instructions nor overlap a stimulus rendered asynchronously — RENDER_VERSION 3
- 2026-11-21 21:49 — Repeated keydowns suppress native defaults as well as shortcuts on the practice container — holding Enter must not repeatedly activate a focused button — RENDER_VERSION 3
- 2026-11-21 21:56 — Initial and redo-setup messages share the any-key Start wording; the returning-user prompt follows the first gesture's focus change if still in level select — hints must match the new Start button and the first Tab must not cut off the level instructions — RENDER_VERSION 3
- 2026-11-21 — Blind-view message text scales by length: 48px up to 60 characters, 34px up to 140, 28px beyond; the message scrolls inside its own area and the controls sit below it instead of covering it. This relaxes "text in the blind view is at least 48 px" for long lesson paragraphs on phones only — the owner said full-size lesson text was too big and needed scrolling — RENDER_VERSION 3
- 2026-11-22 00:10 — Android hardening: volume keys caught in `dispatchKeyEvent` (down and its matching up swallowed, repeats dropped native and JS); predictive back on; native TTS always ends each utterance (init failure, error, stop, watchdog) and JS narration has a length-based timeout; vibration via VibratorManager/VibrationEffect/legacy by API level; mic runtime permission requested before `getUserMedia` with an "Open settings" button when refused; screen kept on — the app misbehaved on an Android 13 phone and must run on API 24+ — RENDER_VERSION 3
- 2026-11-22 00:10 — Gestures now fire on the message, chips and headings (only real controls are skipped); a long press there reads aloud when our voice is on, else it is Answer/Next. Help and Level list gestures work in every phase but onboarding; long press and Volume up accept a stretch offer before Next; Volume down in feedback is Next (§13.3). Overrides §13.8's "gestures ignore touches on these elements" — the message covers most of the screen, so taps there were lost — RENDER_VERSION 3
- 2026-11-22 00:10 — Touch fixes: an Android pointercancel after 300 ms without movement still counts as a long press; a stuck finger is forgotten after 2 s; a cancelled read-aloud hold no longer swallows the next tap; an overflowing message scrolls by touch (`touch-action: pan-y`), so vertical swipes there scroll instead of acting. Nothing under Settings acts while it is open. The audio context resumes on every use, and Start no longer waits for it — touch pointerdown is not a user gesture on Android — RENDER_VERSION 3
- 2026-11-22 00:10 — TalkBack-forced `screenreader` narration is no longer saved over the user's choice. Contrast renders from the pose the player answered from, not the last click. Lesson 6 and the real-room intro say Echo is practice, not a navigation aid; the real-room reveal states the difference; L4/L5 pass feedback names the cue — bugs and §7.3/§13.6/§13.7 gaps found in review — RENDER_VERSION 3
- 2026-11-22 — Storage audit: progress.ts validates every stored value (bad fields fall back to defaults, logs capped at 400 trials / 200 runs and halved when the store is full); Reset progress also returns echo speed to default; Redo setup and Reset ask for an in-panel confirmation; hiding the app stops speech, sound and mic, and the mic restarts on return; native launch turns a saved 'screenreader' narration into voice when TalkBack is off — a full store, old-build data or a forced value must never crash or silence the app — RENDER_VERSION 3
- 2026-11-22 — On-device QA fixes: `.blind-view` (a scroll container) gets `touch-action:none` on gesture/setup screens so swipes are not cancelled by the browser pan, and auto margins replace `justify-content:center` so tall messages (landscape) are not clipped; grid `minmax(0,1fr)` and full-width selects/range stop Settings overflowing at 320–412 px; mic detector pauses on the level list and resumes on level start, and a quiet mic test switches it off with click source `key`; Click button, tap and Space render with the direct click in mic mode (only a mic-heard click is echo-only); lesson 1 coach says the mic is off and points to Settings when the click source is `key` — QA on Redmi Note 10 — RENDER_VERSION 3
- 2026-11-22 01:50 — Responsive layout (partial): styles.css reworked to relative sizes (rem, clamp, dvh/svh, minmax(0,1fr), wrapping), safe areas on all sides, buttons min-height 56 px with wrapping labels, controls reachable while long messages scroll; .controls may pan-y only when taller than its space — measured with no failures on 43 screens at 320–392 px wide with text at 100/130/200% and 412 px at 100%; landscape, tablet and desktop sizes still unmeasured (see docs/mobile_status.md) — RENDER_VERSION 3

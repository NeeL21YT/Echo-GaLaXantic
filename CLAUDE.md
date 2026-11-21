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

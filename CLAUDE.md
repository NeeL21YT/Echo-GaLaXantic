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

**Do not add dependencies** beyond `react`, `react-dom`, `zustand`, `vitest`, `@vitejs/plugin-react` and `typescript`. If you believe one is needed, ask first and give the reason. This rules out Three.js, Tone.js, Howler, UI kits, CSS frameworks, chart libraries, analytics and web fonts.

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
3D geometry, noise ladder, material recognition, a personalised recorded-click waveform, adaptive threshold estimation, accounts, backends, ML, mobile layout, head-tracking, floor-plan import, analytics.

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

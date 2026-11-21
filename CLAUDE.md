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

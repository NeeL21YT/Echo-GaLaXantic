# Claude Code Prompts — Echo

Paste one prompt per Claude Code session, in order. Each prompt is self-contained and assumes `CLAUDE.md` and `docs/build_spec.md` are in the repo. Segments 2, 3, 5 and 6 can run in parallel on separate branches; merge them in prompt order.

After each prompt: read Claude's report, do the manual check it lists, then commit.

---

## P0 — Scaffold and contracts (Segment 0, hour 0–2)

```
Read CLAUDE.md and docs/build_spec.md fully before doing anything.

Task: Segment 0 — scaffold and contracts.
1. Create a Vite React TypeScript app in the current folder (strict TS). Add the dependencies zustand, vitest. No others.
2. Create every folder and file from build_spec.md §3. Each file exports typed stubs that throw `new Error('not implemented: <name>')`, except the files below.
3. Implement src/config.ts exactly as in §4.
4. Implement src/types.ts exactly as in §5.1, plus src/levels/types.ts exactly as in §7.1.
5. Add vercel.json with an SPA rewrite to /index.html.
6. Add npm scripts: dev, build, preview, test (vitest run).
7. App.tsx renders a black page with the text "Echo" and a Start button that does nothing yet.

Done when `npm run build` and `npm test` both pass (test files may be empty describe blocks).
Report per CLAUDE.md.
```

---

## P1 — Audio core: click, offline render, player (Segment 1, hour 2–6)

```
Read CLAUDE.md and docs/build_spec.md §6.

Task: Segment 1 — audio core.
Implement:
- src/audio/context.ts: one AudioContext (48 kHz, interactive), lazily created, `unlockAudio()` called from a user gesture.
- src/audio/referenceClick.ts: 4 ms click per §6.2, cached.
- src/audio/stimulus.ts: renderStimulus(voices, { includeDirect }) per §6.3 with OfflineAudioContext. Panner config must be HRTF, distanceModel 'linear', rolloffFactor 0. Warn if peak > 0.98; never rescale.
- src/audio/player.ts: master bus Gain(MASTER_GAIN) → DynamicsCompressor(LIMITER) → destination. play(buffer) stops the current stimulus first and returns a promise resolved on ended. stopAll().
- src/audio/sfx.ts: bump, correct, wrong, levelUp, lrTest(side), all procedural per §6.5.
- A dev page shown when the URL has ?dev=audio: sliders for distance (0.3–8 m), azimuth (−180..180°), stretch (1–8), checkbox includeDirect, a Play button that builds ONE EchoVoice using the §5.3 formulas inline for now (r=0.9, cosθ=1), renders and plays. Plus buttons for each SFX.

Don't touch the engine or levels.
Manual check to list: at stretch 4 with headphones, az −90 is clearly left, +90 clearly right; d 1 m vs 3 m clearly differ in timing and brightness.
Report per CLAUDE.md.
```

---

## P2 — Geometry, worlds, ray caster, echo builder, collision (Segment 2, hour 2–10)

```
Read CLAUDE.md and docs/build_spec.md §5 and §10.1.

Task: Segment 2 — pure engine. No DOM, audio or React imports in src/engine.
Implement:
- src/engine/geometry.ts: vec ops, raySegment(origin, dir, seg) → distance|null, rayCircle(origin, dir, c, r) → distance|null, surface normals, wrapDeg, angle conventions (0° = +y, clockwise positive).
- src/engine/rng.ts: mulberry32(seed).
- src/engine/worlds.ts: room(w,h,gaps), singleWall(side, dist), frontWall(dist), corridor(width, length, poles), lCorridor() per §5.5. Gaps are cut by splitting wall segments.
- src/engine/raycaster.ts: castRays(world, pose) per §5.2.
- src/engine/echoBuilder.ts: buildEchoes(hits, stretch) per §5.3, formulas verbatim, merge to ≤ MAX_VOICES.
- src/engine/collision.ts: move, turn, reachedExit per §5.4.
- Tests in tests/: every case in §10.1 for geometry, raycaster, echoBuilder, collision.

Then replace the inline voice in the ?dev=audio page with a "Room test" button: room(6,6) with a 1 m gap on the north wall, player at the centre facing north, castRays → buildEchoes(stretch from slider) → renderStimulus → play. Add a turn-left/turn-right button pair (15°).

Done when all tests pass and build passes.
Manual check to list: facing the gap, the room sounds "open" ahead; turned 90°, the gap side is quieter.
Report per CLAUDE.md.
```

---

## P3 — Observer view, blind view, controls, styles (Segment 3, hour 4–12)

```
Read CLAUDE.md and docs/build_spec.md §9.1, §9.2 and §9.6.

Task: Segment 3 — views. Use the store shape in §8.2; create src/state/store.ts with that state and simple setters if it doesn't exist yet (no runner logic yet).
Implement:
- src/ui/ObserverView.tsx: Canvas 2D at 60 px/m, centred. Walls 4 px light lines, poles filled circles, player triangle. When lastHits changes, animate all 72 rays outward for 400 ms; hit rays end with a dot whose alpha ∝ voice gain; rays without hits fade dimly to MAX_RANGE_M. Respect devicePixelRatio. Hide the world (show only the player) when a `hideWorld` prop is true.
- src/ui/BlindView.tsx: black, white text ≥ 48 px showing store.message, plus a small line "Level N · Trial i/n · Echo speed: X times slower".
- Layout in App.tsx: observer off → BlindView full screen; on → BlindView 40% left, ObserverView 60% right. A toggle button "Observer view (V)".
- src/ui/Controls.tsx: phase-aware real buttons per §9.2 (render all for now; phase filtering comes in P4).
- src/ui/styles.css per §9.6: system font stack, #000 background, accent #7CF5FF, 3 px focus rings, buttons ≥ 56 px.

Hook the ?dev=audio room test to set lastHits so the observer view animates.
Manual check to list: clicking the room test shows rays escaping through the north gap.
Report per CLAUDE.md.
```

---

## P4 — Runner, Levels 1–3, keyboard, narration, feedback (Segment 4, hour 8–16)

```
Read CLAUDE.md and docs/build_spec.md §7, §8 and §9.3–9.4.

Task: Segment 4 — the playable core.
Implement:
- src/levels/level1Side.ts, level2Distance.ts, level3Door.ts and levels/index.ts, exactly per the §7.2 table. makeTrial must balance answers across a run (shuffle a balanced list with the seeded RNG). L3 bearing check is ±20°.
- src/levels/feedback.ts: explanation strings per §7.3 (name the cue every time) and contrast worlds for L1–L3.
- src/state/runner.ts: the phase machine in §8.1. Answer keys enabled only after ≥ 1 click in the trial. A click = castRays(world, pose) → buildEchoes(hits, stretch) → narrator.cancel + await idle → renderStimulus(includeDirect = clickSource === 'key') → play; store lastHits/lastVoices/lastStimulus.
- src/speech/narrator.ts: speak(text) returning a promise, cancel(), awaitIdle(); rate 1.05, English voice. src/speech/Announcer.tsx: aria-live polite region. A single `say(text)` in the store routes to one of them based on settings.narration.
- src/input/keyboard.ts: listener on the practice container (role="application", tabIndex 0, aria-label "Echo practice area. Press H for help."), ignores event.repeat, full key map per §9.3.
- Feedback actions: R replays lastStimulus; C speaks "Without", plays contrast, waits 400 ms, speaks "With", plays the trial stimulus; Enter/N goes to the next trial.
- src/ui/LevelSelect.tsx: buttons for Levels 1–3 (4–5 disabled with "coming soon").
- Controls.tsx now shows only the buttons valid for the current phase and level.
- Summary: "Level 1. 8 out of 10. Passed." (progress comparison comes in P6).
- Observer view: hideWorld until the trial is answered, for L1–L3.
- Tests in tests/levels.test.ts per §10.1.

Manual check to list: the hour-10 blindfold gate — 10 trials of L1 at stretch 4, target ≥ 8/10, done by 2 people. Tell me which constants to tune if it fails (ECHO_GAIN_SCALE, DIRECT_CLICK_GAIN, click).
Report per CLAUDE.md.
```

---

## P4b — Gate tuning (only if the hour-10 gate fails)

```
Read CLAUDE.md. The hour-10 blindfold gate failed: <paste scores and what testers said, e.g. "left/right obvious but near/far not", "echoes too quiet under the click">.

Task: propose at most 3 concrete changes to constants in src/config.ts (and the click in referenceClick.ts if justified), with the expected audible effect of each. Apply them, bump RENDER_VERSION, add a Decisions log line in CLAUDE.md. Do not change the formulas themselves.
Report per CLAUDE.md.
```

---

## P5 — Movement, Levels 4–5, mic clicks, training wheels (Segment 5, hour 16–24)

```
Read CLAUDE.md and docs/build_spec.md §5.4, §6.6, §7.2 (rows 4–5) and §7.4.

Task: Segment 5.
Implement:
- Movement in the runner: W/S step ±STEP_M via collision.move, A/D turn ±TURN_DEG. On collision: sfx.bump, collisions++, say "Bump. <count>." Each successful step plays a footstep tick (30 ms band-passed noise, procedural, in sfx.ts).
- src/levels/level4Pole.ts and level5Escape.ts per §7.2. L4: 3 runs, a run passes with 0 collisions on reaching the end; feedback on bump names where the pole was relative to the player. L5: timer from first input; exit in < 90 s passes; collisions counted, not failing.
- Enable Levels 4–5 in LevelSelect.
- src/audio/micDetector.ts per §6.6: constraints off, highpass 1500 → analyser, rAF polling, EMA floor, threshold, 300 ms refractory, ignore while a stimulus or speech is playing. Expose start(onClick), stop(), getSettingsReport(). A visible "Mic on" indicator when active.
- Settings toggle for clickSource key/mic. Mic mode renders with includeDirect false.
- Training wheels per §7.4: stretch steps, default 4, stored per (level, stretch) pass streak; after 3 consecutive passes say the suggestion and accept with Y or a button.

Manual checks to list: walking into a wall bumps without moving; mic test (10 clicks → ≥ 8 detections, 30 s silence → 0 triggers) with wired headphones; L5 completes and reports time.
Report per CLAUDE.md.
```

---

## P6 — Onboarding, settings, progress, accessibility pass (Segment 6, hour 16–24)

```
Read CLAUDE.md and docs/build_spec.md §8.3, §9.4 and §9.5.

Task: Segment 6.
Implement:
- src/ui/Onboarding.tsx exactly per §9.5 (Start/unlock → L/R headphone check with retry message → screen-reader question setting narration mode → optional mic with denied-permission fallback → level select). Persist completion.
- src/ui/Settings.tsx: stretch selector, narration mode, click source, volume (master gain multiplier 0–1), mic constraint report (text), "Redo setup", "Reset progress" with an inline confirm step.
- src/state/progress.ts per §8.3: trial log in localStorage key echo.trials.v1, settings in echo.settings.v1, levelStats(). Log every trial with all fields including renderVersion, replays and contrasts.
- The summary now says "Level N. X out of Y. Previously P out of Q. Passed/Not yet." (omit "Previously" on the first run).
- src/ui/ProgressPanel.tsx: per level last/previous/best, as text and buttons only (no charts).
- Accessibility audit of the whole app against the CLAUDE.md accessibility rules; fix every violation. Confirm no speech overlaps a stimulus in either narration mode.

Manual check to list: NVDA + Chrome — complete onboarding and Level 1 without looking at the screen; list each step the tester should hear.
Report per CLAUDE.md.
```

---

## P7 — Tuning and hardening (Segment 7, hour 24–29)

```
Read CLAUDE.md. Blind test results from the team: <paste per-level scores, collisions, quotes, bugs>.

Task: Segment 7 — tuning and bug fixing only.
1. Fix every listed bug. Smallest change each.
2. Propose and apply constant tuning backed by the results (bump RENDER_VERSION, log decisions).
3. Run the clip check: render L3 from each corner facing each wall; report max peak; fix via constants if > 0.98.
4. Verify offline: the production build works with the network disabled after the first load (no external requests in the network panel).
5. Remove the ?dev=audio page from production builds (keep it behind import.meta.env.DEV).
After this prompt: FEATURE FREEZE.
Report per CLAUDE.md.
```

---

## P8 — Ship (Segment 8, hour 29–36)

```
Read CLAUDE.md. Feature freeze is on: no new features.

Task: Segment 8 — ship.
1. Run npm run build and npm test; fix any failures.
2. Write the project README.md for the repo root: what Echo is (2 lines), live URL placeholder, how to run (npm i, npm run dev, npm test), how to use (headphones, Space, levels table, key map), folder map, honest limits (from docs/idea_and_strategy.md §5), credits (Team GaLaXantic), sources link to docs/idea_and_strategy.md.
3. Check every user-facing string against the CLAUDE.md text rules and docs/idea_and_strategy.md §9 wording rules; list and fix violations.
4. Produce a final checklist against build_spec.md §12 with pass/fail for each line.
Report per CLAUDE.md.
```

---

## Utility prompts (use any time)

**Bug report**
```
Read CLAUDE.md. Bug: <what I did> → <what happened> → <what should happen>. Browser: <Chrome/Firefox>. Narration mode: <voice/screenreader>. Find the root cause, fix it with the smallest change, add a test if it's in src/engine, report per CLAUDE.md.
```

**Spec check**
```
Read CLAUDE.md and docs/build_spec.md. Compare the current code with the spec for <section>. List every mismatch as: file — spec says — code does. Don't change code.
```

**Explain for the pitch**
```
Read docs/idea_and_strategy.md and src/engine/*. Explain in 5 plain sentences how one click becomes the echoes the player hears, for a non-technical judge. No jargon beyond "ray", "delay" and "3D audio".
```

# Echo

Echo is a free, browser-based practice space where blind people learn human echolocation. You click (Space key or a real tongue click), Echo traces that click through a simplified 2D room, and every echo plays in 3D through headphones.

Five levels each teach one skill. Training wheels slow the echoes down at first, then bring them back toward real speed.

Live URL: (not deployed yet)

Team GaLaXantic, Orbix 48-Hour Hackathon (Makers Need More), November 2026.

## Requirements

- Desktop Chrome (Firefox is the secondary target).
- Wired headphones. They are the tested setup.
- No account, no backend. The app works offline after the first load.

## How to run

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests (Vitest)
npm run build     # type check and production build
npm run preview   # serve the production build locally
```

Dev-only audio tuning page: open `/?dev=audio` on the dev server. It is not included in production builds.

## How to use

1. Put on headphones and press **Start**.
2. Onboarding asks three things:
   - Do you use a screen reader? This sets how Echo speaks.
   - Headphone check: press the left or right arrow for the side where you hear the tone.
   - Optional: use your own tongue click through the microphone. Skip uses the Space key.
3. Pick a level from the level list.
4. Click, answer, then listen to the feedback. Replay or compare as often as you like.

### Levels

| # | Title | Skill | Action | Pass |
|---|---|---|---|---|
| 1 | Which side? | Direction | Click (Space) as often as wanted, answer ← / → | ≥ 8/10 |
| 2 | Near or far? | Distance | Click, answer 1 (near) / 2 (far) | ≥ 8/10 |
| 3 | Find the door | Gaps are silent | A/D to turn, Space to click, Enter when facing the door | Each trial correct if \|heading − bearing to gap centre\| ≤ 20°. Pass at ≥ 4/5 |
| 4 | The pole | Small objects | W/S walk, A/D turn, Space click; reach the far end | A run passes if the end is reached with 0 collisions. Pass at ≥ 2/3 |
| 5 | Escape | Combined | Walk to the exit | Exit reached in < 90 s. Collisions are counted but don't fail the run |

Bumps (collisions) play a soft sound and say "Bump." There are no fail screens.

### Key map

The practice area has focus while you use these keys. Every action is also a button.

| Key | Action |
|---|---|
| Space | Click |
| ← / → | Answer left / right |
| 1 / 2 | Answer near / far |
| A / D | Turn left / right |
| W / S | Step forward / back |
| Enter | Begin, answer, or next (depends on the screen) |
| R | Replay the last sound |
| C | Compare: without the object, then with it |
| N | Next trial |
| Y | Accept faster echoes (training wheels offer) |
| V | Observer view (rays are drawn on screen) |
| H | Help: speaks the key map |
| Esc | Back to the level list |

### Training wheels

- Echo speed starts at 4 times slower. The steps are 8, 6, 4, 3, 2, 1.5 and 1 times slower. At 1 the echoes play at real speed.
- After 3 passes in a row at the current speed, Echo offers the next step closer to real speed. Press Y to accept.
- Change the speed in Settings at any time.

## Folder map

- `src/engine`: pure echo model. Ray casting, echo builder, collisions, worlds. No DOM, no audio.
- `src/audio`: Web Audio. Click, offline rendering, HRTF player, mic click detector, sound effects.
- `src/speech`: narration. Spoken voice or a screen reader live region, never both.
- `src/levels`: the five level definitions and the spoken feedback after each answer.
- `src/state`: game flow (runner), Zustand store, and progress saved on this device.
- `src/input`: keyboard map for the practice area.
- `src/ui`: React screens. Onboarding, level list, blind view, observer view, settings, progress.
- `tests`: Vitest unit tests for the engine, levels and geometry.
- `public/sw.js`: service worker for offline reloads of app files.
- `src/config.ts`: every tunable number, with a comment for each.

Docs: `docs/build_spec.md` (architecture, formulas, levels, UI, tests), `docs/idea_and_strategy.md` (problem, pitch, honest limits), `docs/mobile_status.md` (Android fixes, checks still to do, known issues), `docs/claude_code_prompts.md` (build prompts), and `CLAUDE.md` (rules for the build).

## Honest limits

- Echo uses a simplified 2D model. It has no diffraction and no real reverb. It trains attention to echo cues (direction, delay, gaps). It does not reproduce real acoustics.
- Echo is not a navigation aid. Practice is seated.
- Echo complements the long cane. It does not replace it.
- The training effect is not clinically validated. Whether practice transfers to real-world echolocation is a hypothesis that needs testing with blind learners and orientation and mobility trainers.
- It needs headphones. Wired headphones are the tested setup.

## Credits

Built by Team GaLaXantic for the Orbix hackathon.

Background and sources: [docs/idea_and_strategy.md](docs/idea_and_strategy.md).

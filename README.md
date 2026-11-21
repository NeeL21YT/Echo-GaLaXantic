# Echo

Echo is a free, browser-based practice space where blind people learn human echolocation. You click (Space key or a real tongue click), Echo traces that click through a simplified 2D room, and every echo plays in 3D through headphones.

Five levels each teach one skill. Training wheels slow the echoes down at first, then bring them back toward real speed.

Echo also runs as an Android app, where it adds a **real room check**: the phone plays a short chirp, records the room with its microphone, and measures the nearest surface within five metres, so you can practise on real walls instead of a simulated room. It also records which way the phone was pointing at each ping, so it can say how far you turned between pings. It never claims which way an echo came from, because one phone microphone cannot know that.

Live URL: (not deployed yet)

Android build: `npm run build`, then `npx cap sync android`, then Gradle `assembleDebug`. The full build, install and phone-test procedure is in [docs/mobile_status.md](docs/mobile_status.md) §5.

Team GaLaXantic, Orbix 48-Hour Hackathon (Makers Need More), November 2026.

## Requirements

- Desktop Chrome (Firefox is the secondary target).
- Wired headphones. They are the tested setup.
- An Android phone for the real room check. It is intended for the phone: on a desktop the speaker and microphone are far apart and browser echo cancellation is aggressive, so its distances are not trustworthy.
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
5. On a phone, the **Real room check** at the top of the level list lets you try it against a real wall. See below.

### Levels

| # | Title | Skill | Action | Pass |
|---|---|---|---|---|
| 1 | Which side? | Direction | Click (Space) as often as wanted, answer ← / → | ≥ 8/10 |
| 2 | Near or far? | Distance | Click, answer 1 (near) / 2 (far) | ≥ 8/10 |
| 3 | Find the door | Gaps are silent | A/D to turn, Space to click, Enter when facing the door | Each trial correct if \|heading − bearing to gap centre\| ≤ 20°. Pass at ≥ 4/5 |
| 4 | The pole | Small objects | W/S walk, A/D turn, Space click; reach the far end | A run passes if the end is reached with 0 collisions. Pass at ≥ 2/3 |
| 5 | Escape | Combined | Walk to the exit | Exit reached in < 90 s. Collisions are counted but don't fail the run |

Bumps (collisions) play a soft sound and say "Bump." There are no fail screens.

### Real room check (phone)

One to five metres from a wall, hold the phone flat at chest height with its top edge pointing at the wall.

1. **Ping.** The phone plays a chirp and listens. It needs a quiet room, a hard flat wall, and the speaker on (unplug headphones).
2. **Guess first.** Far and Near move the guess by half a metre. Lock in the guess.
3. **Hear the answer.** Echo says the measured distance and how far off you were. After three close guesses in a row it holds the number back until you ask for it.
4. **Turn to compare.** Turn between pings to practice facing different walls; Echo compares headings and, on Replay, names the nearest reading by the way you were facing when you took it.

What it does not claim: the distance is to the *nearest surface*, which may be a table or a person rather than the wall you meant. Soft, cluttered or echoey rooms give weak or disagreeing echoes, and Echo then says so ("My pings disagreed in this room, so that distance is rough") rather than sounding certain. If the phone overrides the request to switch off echo cancellation, Echo warns that its distances may be wrong. The heading always describes the way the **phone** was held, never the way the echo came.

### Places and marks

At one standing spot, ping two ways, then **Save this place** (P). Echo keeps up to eight places on the phone, each remembered by what that spot sounds like.

To record what you know is there, press **Mark what is here** (M), then **Wall** (3), **Doorway or opening** (4), **Step or drop** (5) or **Obstacle** (6). The mark keeps the facing and the distance measured at that moment. Up to twelve marks are kept per place.

Come back to the same spot, ping two ways, and Echo says *"This looks like Place one"*. Replay reads back what you marked facing that way, and says when a measurement no longer matches a mark ("You marked a doorway here at one metre; it now measures two metres").

This is recognition, not a map. Echo does not know where a place is, how far it is from another place, or which way to walk; it has no position, and step counting would drift too fast to help. Two places that sound alike are refused rather than guessed. Places need the phone's heading sensor, and Reset progress in Settings deletes them.

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

In the real room check the same keys apply: Space pings, 1 and 2 are Near and Far, Enter locks in the guess, R repeats the numbers, N is the next trial, and Esc leaves and closes the microphone. Two more belong to that screen only: P saves the place you are standing in, M starts a mark, and then 3 to 6 choose Wall, Doorway or opening, Step or drop, or Obstacle.

### Training wheels

- Echo speed starts at 4 times slower. The steps are 8, 6, 4, 3, 2, 1.5 and 1 times slower. At 1 the echoes play at real speed.
- After 3 passes in a row at the current speed, Echo offers the next step closer to real speed. Press Y to accept.
- Change the speed in Settings at any time.

## Folder map

- `src/engine`: pure echo model. Ray casting, echo builder, collisions, worlds, plus the real-room ranging maths (`ranging.ts`) and heading maths (`roomDirection.ts`). No DOM, no audio.
- `src/audio`: Web Audio. Click, offline rendering, HRTF player, mic click detector, sound effects, and the real-room chirp and capture (`ranger.ts`).
- `src/speech`: narration. Spoken voice or a screen reader live region, never both, and the real-room wording (`roomText.ts`).
- `src/levels`: the five level definitions and the spoken feedback after each answer.
- `src/state`: game flow (runner, lesson runner, real-room runner), Zustand store, and progress saved on this device.
- `src/input`: keyboard map for the practice area, gestures, volume keys, and the phone heading sensor (`compass.ts`).
- `src/ui`: React screens. Onboarding, level list, blind view, observer view, settings, progress.
- `tests`: Vitest unit tests for the engine, levels, geometry, real-room ranging and wording.
- `public/sw.js`: service worker for offline reloads of app files.
- `src/config.ts`: every tunable number, with a comment for each.

Docs: `docs/build_spec.md` (architecture, formulas, levels, UI, tests), `docs/idea_and_strategy.md` (problem, pitch, honest limits), `docs/mobile_status.md` (Android fixes, checks still to do, known issues), `docs/claude_code_prompts.md` (build prompts), and `CLAUDE.md` (rules for the build).

## Honest limits

- Echo uses a simplified 2D model. It has no diffraction and no real reverb. It trains attention to echo cues (direction, delay, gaps). It does not reproduce real acoustics.
- Echo is not a navigation aid. Practice is seated.
- Echo complements the long cane. It does not replace it.
- The training effect is not clinically validated. Whether practice transfers to real-world echolocation is a hypothesis that needs testing with blind learners and orientation and mobility trainers.
- It needs headphones. Wired headphones are the tested setup.
- The real room check measures the nearest surface, not the room. Furniture, doorways and people are surfaces too, and a soft or cluttered room can give weak echoes or no answer at all.
- Real-room ranging accuracy has not been measured against a tape measure on a device. Synthetic tests place a wall within five centimetres; a phone is expected to read a few centimetres short, because time zero is the speaker-to-microphone path.
- The direction pass says nothing about where an echo came from. A phone has one mono microphone, so it can only report the way the phone was held, and only when the phone is fairly flat.
- Saved places are recognised by echo signature, not by position. Echo cannot say where a place is or how two places relate, and two spots that sound alike will not be named at all.
- The Android app has been checked only to the extent recorded in [docs/mobile_status.md](docs/mobile_status.md). Nothing has been verified on a device that is not the team's Redmi Note 10.

## Credits

Built by Team GaLaXantic for the Orbix hackathon.

Background and sources: [docs/idea_and_strategy.md](docs/idea_and_strategy.md).

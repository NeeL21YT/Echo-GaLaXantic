# Echo on Android — fix and test status

Branch: `mobile`. Last updated: 22 November 2026.
Test phone: Redmi Note 10 (M2101K7BI), Android 13. App: debug APK built from this branch.
Checks: `npm run build` has 0 TypeScript errors. `npm test` passes 433 tests in 30 files.

This file has seven parts:
1. What was fixed.
2. What still needs a person to check on a real phone.
3. What is known and not fixed.
4. What to pick up next session.
5. How to build, install and test the Android app.
6. How the phone was tested, and what that method could not cover.
7. The commits for this work.

Design changes are also logged, one line each, in the Decisions log in `CLAUDE.md`.

---

## 1. Fixed

### Android layer (`EchoNativePlugin.java`, `MainActivity.java`, `AndroidManifest.xml`, `src/native/echoNative.ts`)
- **Speech:** the voice could hang forever and block every sound after it.
  - Each spoken line now always ends: on success, error, stop, engine failure, or after a timeout.
  - The language falls back to English if the phone's language has no voice.
- **Microphone permission:** it is now asked for before the mic is used. If refused, Echo says so and shows an **Open settings** button.
- **Volume keys:**
  - Caught before the WebView or TalkBack can take them.
  - Holding a key no longer repeats the action.
  - The system volume slider no longer appears.
- **Back:** supports the Android 13 back gesture. It never closes Echo by accident. If the app is not ready, Back sends it to the background.
- **Vibration:** works on Android 7 to the newest versions.
- **TalkBack:** its state is read at launch, on return to the app, and whenever it changes.
- **Screen:** stays on during practice.

### Touch, buttons and keys (`src/input/*`, `src/App.tsx`)
- **Swipes:** they were cancelled in the level view, so swipe answers never worked. Fixed and confirmed on the phone.
- **Message area:** taps and swipes there were ignored. A long press there now acts (Answer or Next). Holding a button still reads it aloud.
- **Lost touches:**
  - A stuck finger made the next touch count as two fingers.
  - A cancelled hold swallowed the next tap.
  - Android cancelling a long press stopped it.
- **Speed-up offer:**
  - "Yes" by long press or Volume up did not work.
  - Touch users had no way to say no. They now tap with three fingers for the level list.
- **Help and Level list gestures:** the two- and three-finger taps now work on every screen except setup.
- **Settings screen:**
  - Gestures, keys and volume keys no longer act behind it.
  - Escape closes it.
  - Focus returns to the practice area after closing.
- **Answer buttons:** they were greyed out and silent before the first click. They now say "Click first."
- **Volume down after an answer:** now means Next, as in the spec.
- **Volume keys:**
  - During the headphone check, they change the phone volume.
  - While guessing in the real room, they mean Far and Near.
- **Gestures that do nothing:** in voice mode, a gesture that does nothing on the current screen gives a short spoken hint, at most once every six seconds.

### Levels (`src/state/runner.ts`, `src/levels/*`)
- **Contrast:** it played from where you clicked, not from where you answered.
- **Overlapping sound:**
  - The level-up jingle played over the last explanation.
  - Morse could play over speech.
  - An echo from your old position played after you moved.
- **Lost or silent presses:**
  - An answer pressed while the first click was loading was lost.
  - Replay with nothing to replay was silent.
  - Turning gave no feedback. It now gives a soft tick.
  - The observer view on or off was visual only.
- **Telling the user what to do next:**
  - After trial one, nothing said how to continue. Every trial now ends with the next step.
  - Bumps in Levels 4 and 5 now say what to do next.
  - "Not yet" now says you can try again.
- **Pass feedback:** passing Levels 4 and 5 now names the cue.
- **Leaving the app:**
  - A contrast could keep playing in the background.
  - Time away counted against the Level 5 clock.
  - On return, the current message is repeated.
- **Microphone:**
  - If it stops mid-run, Echo switches to tap or Space clicking and says so.
  - In mic mode, the Click button now still clicks.

### Setup, lessons and real room (`src/ui/Onboarding.tsx`, `src/state/lessonRunner.ts`, `src/state/roomRunner.ts`, `src/audio/*`)
- **Silent launch:** the first launch on the phone spoke nothing. Returning users now also hear the level-list prompt at launch.
- **Setup wording:** it was keys only. It is now worded for keys, touch or TalkBack, and touch users can swipe and long-press there.
- **Screen reader at setup:** with TalkBack on, the screen-reader question is skipped.
- **Microphone staying on:**
  - After Back, Redo setup, or ending the mic test with too few clicks, the mic stayed on.
  - It now records only while practising.
  - Back during a real-room ping crashed.
- **Lesson flow:**
  - Lessons now announce themselves, and every page says its number and what to press next.
  - "Practise this skill" spoke over the level intro.
  - Lesson 6 now ends with "Practise this skill", which opens the real-room check.
- **Lesson 1 coach:** it now opens the mic for the lesson on its own. Without a mic it says so and lets you practise alone.
- **Real-room check:**
  - Actions other than Back are ignored while a ping runs, so speech is not recorded as an echo.
  - The reveal now says how far off the guess was.
- **Practice, not a navigation aid:** Lesson 6 and the real-room check now say plainly that Echo is practice, not a navigation aid.

### Real-room direction and robustness (22 November 2026)
Files: `src/engine/roomDirection.ts` (new), `src/input/compass.ts` (new), `src/engine/ranging.ts`, `src/audio/ranger.ts`, `src/speech/roomText.ts`, `src/state/roomRunner.ts`, `src/config.ts` (`HEADING`, two `RANGING` values), `tests/roomDirection.test.ts` (new), `tests/ranging.test.ts`, `tests/roomText.test.ts`.
- **Direction:** the check records the way the phone was pointing at each measured ping and compares headings.
  - Turning between pings is spoken, and Replay can name the nearest reading by the facing it was taken with.
  - It needs the phone fairly flat, because the heading comes from the top edge; the introduction now asks for that hold.
  - A phone with no heading sensor, or a stale reading, hears nothing about direction — the behaviour before this pass.
  - Every line says the way the phone was held, never the way the echo came. One mono microphone cannot know that.
- **Bad takes are thrown away:** a recording that lost audio to the browser is discarded, because a dropped buffer shortens every distance in the take.
- **Disagreement is said out loud:** if the five pings span more than 80 cm, the reveal calls the distance rough instead of certain.
- **A filtered microphone is named:** if the phone insists on echo cancellation, noise suppression or AGC, Echo says once per visit that its distances may be wrong.

### Places and marks (22 November 2026)
Files: `src/engine/placeMap.ts` (new), `src/speech/placeText.ts` (new), `src/state/roomRunner.ts`, `src/state/progress.ts`, `src/state/store.ts`, `src/input/keyboard.ts`, `src/ui/labels.ts`, `src/config.ts` (`PLACES`), `tests/placeMap.test.ts` (new), `tests/placeText.test.ts` (new), `tests/progress.test.ts`, `tests/journey-setup.test.ts`.
- **What a place is:** after two facings at one standing spot, Save this place keeps what the spot sounds like — the distance to the nearest surface in each facing — in `localStorage` under `echo.places.v1`.
  - Up to eight places, twelve marks each, bounded and validated like every other saved value.
  - Coming back, two pings are matched against the saved signatures, and Echo says "This looks like Place one".
  - Two places that fit equally well are not named; Echo says they sound too alike instead.
- **What a mark is:** Mark what is here, then Wall, Doorway or opening, Step or drop, or Obstacle. The kind is stored with the facing and the distance measured at the time.
  - Replay reads back the marks facing the current way.
  - A fresh measurement that no longer matches a mark is reported, with no guess about why it changed.
- **No position:** this is spot recognition, not a map. There is no GPS, no step counting, no route, and no distance or bearing between two places.
- **Places need a heading.** With no sensor, or a stale reading, nothing is ever recognised and nothing is recorded. The keys 3 to 6, M and P exist only in the real-room check.
- **Reset progress** in Settings now deletes saved places as well as scores.
- **Fixed while adding this:** a ping cut off by Back left the check permanently "busy", so the next visit's first ping did nothing at all. The guard is now released on leaving, and an old ping can no longer clear a new visit's guard.

### Saved data and Settings (`src/state/progress.ts`, `src/ui/Settings.tsx`)
- **Bad saved data:** corrupt or old saved data could crash or silence the app. Every stored value is now checked.
- **Storage limits:**
  - Logs are capped at 400 trials and 200 runs.
  - A full store is handled without crashing.
- **Silent app after TalkBack:** an old build could save a forced screen-reader setting, leaving the app silent once TalkBack was off. That setting is now corrected.
- **Reset progress and Redo setup:**
  - Both now ask first.
  - Both stop any run in progress.
  - Reset also returns echo speed to the default and goes to the level list.
- **Settings changes:** every change is announced, saved and applied at once.
- **Layout:** Settings was wider than the phone screen. Fixed and confirmed on the phone.

### Words a blind user hears
- **Numbers:** spoken and shown as words ("Trial two of ten", "half a metre", "forty degrees", "four times slower").
- **One name per thing:** Level list, Contrast, Far and Near, Yes faster echoes.
- **Instructions:** they match the input style. Touch and TalkBack users are never told to press Space or Escape.
- **Lesson 5:** it described Level 4 wrongly. The doorway is always "the quiet side".

### Responsive layout (partly done, stopped on 22 November 2026)
Files: `src/ui/styles.css` (about 475 lines reworked) and `src/ui/Controls.tsx`.
- **Sizing:** the layout uses relative sizes (`rem`, `clamp()`, `dvh`/`svh` with `vh` fallback, `minmax(0, 1fr)` grids, wrapping), not fixed pixel sizes.
- **Safe areas:** they are respected on all sides.
- **Buttons:**
  - They keep a minimum height of 56 px and their labels may wrap, so text is never cut off.
  - The action buttons stay reachable while a long message scrolls in its own area.
- **Very large text:** the button area may scroll vertically only when it is taller than its space (`data-scroll` on `.controls`). Otherwise swipes stay gestures, and the seg26 swipe fix is kept.
- **Measured with no failures** in a headless browser (scripted DevTools checks):
  - 43 screens at every size: all setup steps, the level list, every phase of Levels 1 to 5, the summary, lesson pages, the real-room check, Settings and the observer view.
  - Checks: no sideways scrolling, nothing past the screen edge, no button under 56 px, nothing clipped or overlapping, nothing under the safe area, and controls in view.
  - Sizes: 320×568, 360×640, 375×667 and 392×873, each at text size 100%, 130% and 200% (Android's large-font setting), and 412×915 at 100%.
- **Build:** `npm run build` and the whole test suite passed with these changes (382 tests at the time).

### On-phone test results (three rounds)
- **Passed:**
  - First-run setup and the headphone check, by button and by swipe.
  - Level 1 and Level 2 full runs, including swipe answers.
  - Level 3 feedback.
  - Level 4 bumps and reaching the corridor end.
  - Lessons 2 to 6, each opening the right practice.
  - The Lesson 1 coach.
  - The real-room ping and Back.
  - Every Settings change, which is spoken and still set after a restart.
  - Reset progress and Redo setup.
  - Rotation.
- **Errors:** no crashes and no console errors. The only console messages were a missing-favicon 404 and a deprecation warning.

---

## 2. Still to check on a real phone

The test phone blocks automated key presses, and the tests cannot hear sound. A person needs to check these:

1. **Hardware Back:** from a lesson or a level it goes to the level list. Pressed twice within two and a half seconds on the level list, it closes Echo.
2. **Volume keys:**
   - In a level: up clicks, down replays, and after an answer down means Next.
   - On the level list: down moves to the next option, up chooses.
   - In the real room, while guessing: up is Far and down is Near.
3. **Two- and three-finger taps:** Help, and the level list.
4. **TalkBack:**
   - Echo's own voice goes quiet.
   - The volume keys change the volume again.
   - Every button can be read and pressed.
5. **Sound, with headphones:** click and echoes, left and right, near and far, the jingles, the turn tick, Morse beeps and vibration patterns.
6. **Real room, in a quiet room facing a wall:**
   - Hold the phone flat, top edge pointing at the wall, and ping. You should hear the flat-hold line once, and no warning that the phone is filtering its microphone.
   - Ping again without turning: "You are facing the same way as your last measurement."
   - Turn about ninety degrees between pings: the turn is spoken, and Replay may name a nearer reading from the other facing.
   - Guess with Far and Near, Lock in my guess, Tell me the distance, Next.
   - In a cluttered or soft room the distance should be called rough, not certain.
7. **Level 5:** walk to the exit, then the summary.
8. **Speed-up offer:** pass a level three times at eight out of ten or better, then choose Yes or the level list.
9. **"Previously…" on the summary:** play the same level a second time.
10. **Landscape:** on a fresh first run, the first line of the headphone check is fully visible.
11. **Mic permission refused:** the Open settings button appears and opens the phone's settings.
12. **Lesson 1 coach in a quiet room:** the verdicts (good, quiet, loud, long, dull) make sense. The thresholds in `CLICK_COACH` are first guesses.
13. **TalkBack plus Morse sound:** Morse waits about one and a half seconds for TalkBack to finish. Check it does not talk over it.
14. **Places:** at one spot, ping two ways, then Save this place.
   - It should say "Saved as Place one." and offer the four mark kinds.
   - Mark a doorway, lock in a guess, and Replay should read the mark back by facing and distance.
   - Try again from the same spot: two pings should say "This looks like Place one."
   - Two spots that sound alike should be refused, not guessed at.

---

## 3. Known and not fixed

None of these stop the app being used. They are listed so nothing is hidden.

- **Disabled buttons:** holding a finger on one probably does not read it aloud, because the browser does not send touch events to disabled buttons.
- **Back button:** the on-screen Back button scrolls away on long pages. The phone's Back still works.
- **Observer map:** in portrait it sits below the first screen, so you have to scroll to see it. It is a tool for sighted helpers.
- **Mic in Settings:** opening Settings during a level leaves the mic open. Clicks are ignored while Settings is open.
- **Feel the answer:** it gives no buzz for "Facing the door" in Level 3. The touch tick is given only for gestures that act.
- **Lesson demo position:** the Lesson 5 demo stands at the corridor's back wall, not at Level 4's start position.
- **Deprecated mic API:** the mic code uses `ScriptProcessorNode`. It still works, but browsers mark it as deprecated.
- **Numbers in the code:** some numbers are still written in audio, speech and world code instead of `config.ts`, for example Morse gap lengths and world sizes.
- **Out-of-date spec:** `build_spec.md` §13.6 now matches the code, but many newer `config.ts` groups (`HEADING`, `RANGING`, `GESTURE`, `VOLUME_KEY`, `MORSE`, `HAPTIC`, `STORAGE_LIMITS`, `SCREEN_READER_WAIT`, `CLICK_COACH`) are still absent from the spec's config appendix.
- **Real room, no echo direction:** a phone has one mono microphone, so Echo cannot hear which way an echo came from at any price. The direction pass reports only the way the phone was held.
- **Real room, nearest surface:** the number is to whatever reflects first — a table, chair, curtain or person — not necessarily the wall the learner meant.
- **Real room, phone filters:** if Android ignores the request to switch off echo cancellation, AGC or noise suppression, the direct path and near echoes can be removed and the numbers are wrong. Echo now warns, but cannot prevent it.
- **Real room, flat hold:** the heading needs the phone fairly flat, so an upright hold gives no direction at all, silently.
- **Real room, magnetometer:** a jump in the absolute heading (a metal doorway, a laptop, a magnet) can invent a turn of ninety degrees.
- **Real room, iPhone:** `DeviceOrientationEvent.requestPermission()` is never requested, so heading is Android-only today.
- **Real room, dropped audio:** the fill check catches gross loss, but a gap in the middle of one otherwise complete take can still slip through. Moving the capture to an `AudioWorklet` would fix it properly.
- **Real room, no memory:** every visit starts from nothing; there are no saved spots.
- **Real room, grading:** a guess is still judged even when the reading was just called rough.
- **Places, no position:** saved places are echo signatures, not coordinates. Echo cannot say where a place is, how far it is from another place, or which way to walk, and it cannot tell that two visits ten steps apart are the same room.
- **Places, lookalikes:** a room whose facings sound alike from two different spots cannot be told apart, so neither is named. Marks belong to the place they were made in, not to the object.
- **Places, sensor:** with no heading sensor, or when the phone is held upright, nothing is saved or recognised. Places are Android-only for the same reason as direction, until the iPhone permission request is added.
- **Spec deviations:** several are intentional and recorded in the `CLAUDE.md` Decisions log:
  - Gestures act on the message area.
  - Long lesson text is shown smaller than 48 px.
  - The mic records only while practising.
  - Lesson 6 links to the real-room check.
- **Responsive layout, not yet measured:** this work stopped before these sizes were checked:
  - 412×915 at text size 130% and 200%.
  - 430×932.
  - All landscape sizes, for example 873×392 and 640×360.
  - Tablets at 600×960 and 800×1280.
  - Desktop at 1280×800 and 1920×1080.
- **Responsive layout, not tried on the phone:** the new layout has not been installed on the phone yet, so it has only been measured in a headless browser. Earlier on the phone, the on-screen Back button scrolled away on long pages, the observer map sat below the first screen, and landscape text slipped under the status bar. These are not yet confirmed fixed on the device.
- **Screen readers other than TalkBack:** on the phone, a user who uses a different screen reader and picks "My screen reader" is switched back to Echo's voice at the next launch.

---

## 4. Pick up next session

1. **Finish the responsive layout check.** Measure the sizes still missing (see section 3) with the same checks. Fix anything that fails in `src/ui/styles.css` only, without changing wording or game logic. Keep `touch-action` as it is (`none` on gesture surfaces, `pan-y` only on `.blind-view[data-scroll='true']`).
2. **Build and install the APK.** Run `npm run build`, `npx cap sync android`, then `cd android && gradlew assembleDebug`, then `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. Check on the phone:
   - Portrait, landscape and large font.
   - The Back button stays reachable on long pages.
   - The observer map is placed sensibly.
   - Swipes still answer in Levels 1 and 2.
3. **Do the person checks in section 2:** hardware Back, volume keys, multi-finger taps, TalkBack, sound, real room, Level 5, the speed-up offer and "Previously…".
4. **Run the real-room check on the phone before changing any of it.** In a quiet room with one hard flat wall, do the five checks in section 2 item 6. Interpret what you hear:
   - No direction lines at all: the phone has no absolute heading event, or it is being held upright. The check is still working as it did before the pass.
   - "I could not find a wall" every time: suspect the room's softness first, then the "filtering its microphone" warning, then the sensor.
   - Distances too short by a consistent amount: expected bias from the speaker-to-microphone path; measure once against a tape measure before changing `RANGING`.
   - Erratic distances within one visit: that is what an `AudioWorklet` capture would fix; do not paper over it with thresholds.
5. **Finish the doc drift in `build_spec.md`:** list the newer `config.ts` groups in its config appendix, and check the §13.8 deviation note.
6. **Decide what places should grow into**, now that spot recognition exists: remembering a mark across places (for example "the doorway I marked is this same doorway"), or a spoken list of saved places. Do not add step counting to fake a position; it drifts within a few steps and cannot tell you that you have arrived somewhere.

---

## 5. Build, install and test setup (Windows)

This is the set-up used on the team's Windows PC.
- **Android SDK:** command-line tools only, no Android Studio, in `C:\Android\Sdk`. Packages installed:
  - `platform-tools`, which includes `adb`.
  - `platforms;android-36`.
  - `build-tools;36.0.0`.

  The SDK licences were accepted with `sdkmanager --licenses`.
- **Java:** JDK 21 at `C:\Program Files\Java\jdk-21`.
  - The system `JAVA_HOME` was wrongly set to `...\jdk-21\bin`, which breaks `sdkmanager` and Gradle.
  - Either fix it in Windows environment variables, or set it per shell: `$env:JAVA_HOME="C:\Program Files\Java\jdk-21"`.
- **SDK location:** `android/local.properties` (git-ignored) contains `sdk.dir=C:/Android/Sdk`. Use forward slashes; a Windows path with unescaped backslashes breaks Gradle with "The filename, directory name, or volume label syntax is incorrect".
- **Build the debug APK** (PowerShell, from the repo root):

  ```
  npm ci
  npm run build
  npm test
  npx cap sync android
  cd android; .\gradlew.bat assembleDebug
  ```

  The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Install on a phone:**
  1. Turn on Developer options and USB debugging.
  2. Set the USB mode to File transfer.
  3. Accept "Allow USB debugging".
  4. Run `C:\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\debug\app-debug.apk`.

  You can also copy the APK to the phone and open it there.
- **Line endings:** `npx cap sync` rewrites the line endings of `android/app/capacitor.build.gradle` and `android/capacitor.settings.gradle`. These are line-ending changes only; discard them with `git checkout -- <file>` before committing.

---

## 6. How the phone was tested

- **Phone and rounds:** three on-device test rounds ran on the Redmi Note 10 (Android 13, 1080×2400, 392 CSS px wide).
- **How the app was driven:** through the debug WebView's DevTools protocol, with `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` and a small Node script.
  - The script sent touch and key events into the page.
  - It read the on-screen message, the buttons and the live region.
  - It recorded every line passed to the native speech engine.
  - It logged console errors.
  - It took screenshots with `adb exec-out screencap`.
  - It checked microphone use with `dumpsys audio`.
- **Limits:** this phone runs MIUI, which refuses `adb shell input` (tap, swipe, key events), `pm clear` and `settings put`. Because of that, these could not be tested automatically:
  - Hardware Back, the volume keys and Home.
  - Real finger touches, as opposed to events sent into the page.
  - Two- and three-finger taps.
  - TalkBack.
  - Sound, because the tests cannot hear.

  These are the checks listed in section 2.
- **adb-mcp plugin:** it was installed, but its server failed to connect ("Connection closed"), so plain `adb` was used instead.
- **Responsive layout:** measured in a headless Chromium browser (Brave) against `vite preview`, using the DevTools device-size emulation at each screen size. The measuring script was a throwaway local file and is not in the repo.
- **Automated tests:** they grew from 283 to 433, in 30 files. The new tests include:
  - Real-room ranging, disagreement and direction maths (`tests/ranging.test.ts`, `tests/roomDirection.test.ts`).
  - Real-room wording (`tests/roomText.test.ts`).
  - Place matching, marks and their wording (`tests/placeMap.test.ts`, `tests/placeText.test.ts`).
  - The save, mark and recognise journey, and place storage (`tests/journey-setup.test.ts`, `tests/progress.test.ts`).
  - Full flow runs of Levels 1 to 5 (`tests/journey-levels.test.ts`).
  - Setup, lessons and the real room (`tests/journey-setup*.test.ts`, `tests/coachMicOff.test.ts`).
  - Saved data (`tests/progress.test.ts`).
  - Wording (`tests/wording-levels.test.ts`).
  - Narration timeouts (`tests/narrator.test.ts`).
  - Gestures and volume keys.

---

## 7. Commits for this work (branch `mobile`)

| Commit | What |
|---|---|
| `2e49906` seg22 | Android hardening: speech always ends, mic permission, volume keys, Back, vibration across API levels |
| `9182d06` seg23 | Saved-data validation, storage caps, confirmed Reset and Redo setup, spoken Settings changes |
| `1bbc5ac` seg24 | Setup, lessons and real room: mic released on leave, wording per input style, Lesson 6 practice link |
| `182560b` seg25 | Level runs: contrast from the answered direction, next step after every trial, no overlapping sound, numbers as words |
| `f7d9189` seg26 | Touch and keys: swipes no longer cancelled, long press on the message acts, volume-key guards, phone layout fits |
| `ffeab9f` seg27 | Docs: this status file and the Decisions log |
| `f3ae219` seg28 | Responsive layout for phone sizes and large text (landscape, tablet and desktop still to measure) |
| `f31f861` seg29 | Docs: responsive status, remaining unfixed items, next-session plan |

Uncommitted at the time of writing: the real-room direction and robustness pass, and the places and marks pass, both described in section 1, plus the README and spec updates that go with them.

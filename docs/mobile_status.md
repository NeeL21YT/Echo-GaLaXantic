# Echo on Android — fix and test status

Branch: `mobile`. Last updated: 22 November 2026.
Test phone: Redmi Note 10 (M2101K7BI), Android 13. App: debug APK built from this branch.
Checks: `npm run build` has 0 TypeScript errors. `npm test` passes 382 tests in 27 files.

This file has three parts:
1. What was fixed.
2. What still needs a person to check on a real phone.
3. What is known and not fixed.

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
6. **Real room, in a quiet room facing a wall:** ping, guess with Far and Near, Lock in my guess, Tell me the distance, Next.
7. **Level 5:** walk to the exit, then the summary.
8. **Speed-up offer:** pass a level three times at eight out of ten or better, then choose Yes or the level list.
9. **"Previously…" on the summary:** play the same level a second time.
10. **Landscape:** on a fresh first run, the first line of the headphone check is fully visible.
11. **Mic permission refused:** the Open settings button appears and opens the phone's settings.
12. **Lesson 1 coach in a quiet room:** the verdicts (good, quiet, loud, long, dull) make sense. The thresholds in `CLICK_COACH` are first guesses.
13. **TalkBack plus Morse sound:** Morse waits about one and a half seconds for TalkBack to finish. Check it does not talk over it.

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
- **Out-of-date spec:** `build_spec.md` still says `RENDER_VERSION` 1, `fftSize` 512, and "2 of 12" for menu scanning. Many newer `config.ts` groups are not listed there.
- **Spec deviations:** several are intentional and recorded in the `CLAUDE.md` Decisions log:
  - Gestures act on the message area.
  - Long lesson text is shown smaller than 48 px.
  - The mic records only while practising.
  - Lesson 6 links to the real-room check.
- **Screen readers other than TalkBack:** on the phone, a user who uses a different screen reader and picks "My screen reader" is switched back to Echo's voice at the next launch.

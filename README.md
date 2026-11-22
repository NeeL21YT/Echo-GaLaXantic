<p align="center">
  <img src="assets/logo.png" alt="Echo logo: a cyan dot with three sound arcs on black" width="160" />
</p>

# 🔊 Echo

> **Learn to listen to the world, one click at a time.**

Echo is a free practice space where blind people learn **human echolocation**: making a sharp click with the tongue and hearing what the echoes say about the space around them. It runs in the browser and as an **Android app**, with no account, no backend and no network needed after the first load.

## 📖 About

Some blind people find walls, doorways and poles by clicking and listening to the echoes. It can be learned, but almost nobody can get trained, and the street is a poor place to practise.

Echo gives learners a safe place to start. You click, Echo traces the click through a simplified room, and every echo plays around your head in 3D through headphones. After every answer Echo tells you **which cue to listen for**, lets you replay the exact sound, and plays an A/B contrast, so you are being taught and not only tested.

Echo trains the person's own ears. It does not tell them what is there, and it keeps working in the real world because nothing depends on the phone.

---

# ✨ Features

## 🎓 Learn
Six short spoken lessons teach the technique before any test.
- How to make a clean palatal tongue click
- A **click coach** that listens through the microphone and says whether each click was good, too quiet, too loud, too long or too soft, with one fix
- Side-by-side examples: wall left or right, near or far, a doorway, a pole
- A real-room routine for taking the skill off the screen

## 🎯 Practise
Five levels, one skill each, with pass rules and no harsh fail screens.
- Which side is the wall, and is it near or far
- Doorways are silence: find the gap in a wall
- The pole: small objects
- Escape: walk out of a corridor
- **Training wheels** slow the echoes down 8× at first and bring them back toward real speed as you pass

## 🧑‍🏫 The instructor loop
- Says which cue to listen for after every answer
- Replay the exact same sound
- A/B contrast: without and with the object or the gap
- An **observer view** draws the rays so trainers and family can see what the learner hears

## 📱 Built for the phone
- **Touch gestures** that need no sight: tap to click, double tap to replay, triple tap to compare, swipes to answer or walk
- **Volume buttons** as controls: up clicks, down replays, and on the level list they scan the menu and speak each option
- **Touch and hold** any card or message to hear it read aloud
- **Morse code** feedback by vibration or beeps, and **Feel the answer** vibration patterns
- Works with **TalkBack**: when a screen reader is on, Echo's own voice and touch gestures step aside
- A **Back** button and phone-back handling that always go up one step

## 🏠 Real room check
- The phone plays a short chirp, listens, and measures the nearest surface within five metres. Works in the dark, with no camera
- **Guess first**, then hear the real distance. After three close guesses in a row, the number is held back until you ask
- Records which way the phone faced at each ping, and can remember **places** and what you marked in them (wall, doorway, step, obstacle), recognised by what they sound like

---

# 🎨 Design Language

**High contrast × Minimal**

Black background, white text, one cyan accent, big touch targets. Built for low vision and for the sighted helper setting it up.

### Color Palette

| Color | Hex |
|--------|------|
| Black | `#000000` |
| White | `#FFFFFF` |
| Echo Cyan | `#7CF5FF` |
| Card | `#0D0D0D` |
| Border | `#2A2A2A` |
| Muted | `#A8A8A8` |

---

# 🛠 Tech Stack

### App
- React 18, TypeScript (strict), Vite 8
- Web Audio API (offline rendering, HRTF), Canvas 2D
- Zustand 5 for state
- Web Speech API in browsers, Android text-to-speech in the app
- No backend, no ML, no analytics

### Android
- Capacitor 8 (Android)
- A small in-repo Java plugin for TalkBack detection, volume keys, back button, vibration and speech
- Android 7.0 (API 24) and newer, built for Android 16 (API 36)

### Quality
- Vitest, 430+ unit tests covering the echo engine, levels, lessons, ranging, gestures and wording

### Deployment
- Vercel (web), debug APK built with Gradle (Android)

---

# 🚀 Getting started

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests (Vitest)
npm run build     # type check and production build
npm run preview   # serve the production build locally
```

Dev-only audio tuning page: open `/?dev=audio` on the dev server. It is not in production builds.

**Requirements:** desktop Chrome (Firefox is secondary) and wired headphones, or an Android phone. The real room check is for the phone only.

### Build the Android app

Gradle needs **Java 21**.

```bash
npm run build
npx cap sync android
cd android
JAVA_HOME=/path/to/jdk-21 ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The full build, install and phone-test procedure is in [docs/mobile_status.md](docs/mobile_status.md).

---

# 🎮 How to use

1. Put on headphones and press **Start**.
2. Setup asks: do you use a screen reader, a headphone left/right check, and whether to use your own tongue click through the microphone.
3. Start with **Lesson 1**, or pick a level from the list.
4. Click, answer, then listen to the feedback. Replay or compare as often as you like.

### Levels

| # | Title | Skill | Action | Pass |
|---|---|---|---|---|
| 1 | Which side? | Direction | Click, answer left or right | ≥ 8/10 |
| 2 | Near or far? | Distance | Click, answer near or far | ≥ 8/10 |
| 3 | Find the door | Gaps are silent | Turn, click, answer when facing the gap | Within 20° on ≥ 4/5 |
| 4 | The pole | Small objects | Walk to the far end of the corridor | ≥ 2/3 runs with 0 collisions |
| 5 | Escape | Combined | Walk to the exit | Exit in under 90 s |

Bumps play a soft sound and say "Bump."

### Keys and gestures

Every action is also a real button.

| Action | Key | Phone |
|---|---|---|
| Click | Space | Tap anywhere, or volume up |
| Answer left / right | ← / → | Swipe left / right |
| Answer near / far | 1 / 2 | Swipe down / up |
| Turn | A / D | Swipe left / right |
| Step forward / back | W / S | Swipe up / down |
| Begin, answer or next | Enter | Press and hold |
| Replay | R | Double tap, or volume down |
| Compare | C | Triple tap |
| Help | H | Two-finger tap |
| Level list | Esc | Three-finger tap |
| Back | Esc | On-screen Back, or the phone's back |

### Real room check (phone)

Stand one to five metres from a wall, hold the phone flat at chest height with its top edge pointing at the wall, and unplug the headphones.

1. **Ping.** The phone plays a chirp and listens. Use a quiet room and a hard, flat wall.
2. **Guess first.** Far and Near move the guess by half a metre.
3. **Hear the answer.** Echo says the measured distance and how far off you were.
4. **Turn to compare.** Echo compares headings between pings. The heading is the way the **phone** faced, never the way the echo came from.

Places: **Save this place** after two facings at one spot, and **Mark what is here** (wall, doorway or opening, step or drop, obstacle). Coming back, Echo says "This looks like Place one" and reads your marks back. This is recognition by sound, not a map: Echo has no position.

---

# ⚠️ Honest limits

- Echo uses a simplified 2D model with no diffraction and no real reverb. It trains attention to echo cues; it does not reproduce real acoustics.
- Echo is **not a navigation aid**. Practice is seated, and it complements the long cane; it does not replace it.
- The training effect is **not clinically validated**. Whether practice transfers to real-world echolocation needs testing with blind learners and orientation and mobility trainers.
- The real room check measures the nearest surface, not the room. Furniture and people are surfaces too, and a soft or cluttered room can give weak echoes or none. Accuracy has not been measured against a tape measure on a device.
- A phone has one microphone, so Echo cannot say where an echo came from, only which way the phone was held.
- The Android app has been tested on two phones, a Redmi Note 10 and a Realme 9 5G Speed Edition, both on Android 13. Other phones and Android versions have not been tested. Details are recorded in [docs/mobile_status.md](docs/mobile_status.md).
- The click coach thresholds are first guesses and need tuning against real clicks.

---

# 📂 Project map

- `src/engine`: the pure echo model (ray casting, echo builder, collisions, worlds), plus ranging and heading maths. No DOM, no audio.
- `src/audio`: Web Audio, offline rendering, HRTF player, mic click detection, click coach, chirp capture.
- `src/speech`: narration and the wording of every spoken line.
- `src/levels`: the five levels, six lessons and the feedback text.
- `src/state`: game flow, store, saved progress.
- `src/input`: keyboard, gestures, volume keys, back, compass.
- `src/ui`: the React screens.
- `src/native`: the bridge to the Android plugin.
- `android`: the Capacitor project and the Java plugin.
- `tests`: Vitest unit tests.
- `src/config.ts`: every tunable number, with a comment for each.

### Docs

| File | What it is |
|---|---|
| [docs/idea_and_strategy.md](docs/idea_and_strategy.md) | The problem, the pitch, how Echo differs, honest limits |
| [docs/build_spec.md](docs/build_spec.md) | Architecture, formulas, levels, UI, tests, and the mobile spec (§13) |
| [docs/mobile_status.md](docs/mobile_status.md) | Android fixes, what still needs a phone check, known issues |
| [docs/claude_code_prompts.md](docs/claude_code_prompts.md) | The build prompts used to make Echo |
| [CLAUDE.md](CLAUDE.md) | Rules for the build, and the decisions log |

---

# 👥 Team

**Team Name:** **GaLaXantic**

| Member | GitHub |
|--------|--------|
| NeeL21YT | https://github.com/NeeL21YT |
| Dronzer2code | https://github.com/Dronzer2code |
| T-RexBytes | https://github.com/T-RexBytes |
| pritam-mb | https://github.com/pritam-mb |

---

# 🏆 Hackathon

**Event:** Orbix 48-Hour Global Open Innovation Hackathon, 21–23 November 2026

---

# 📄 License

Apache License 2.0. See [LICENSE](LICENSE).

Developed by **Team GaLaXantic** for the **Orbix 48-Hour Global Open Innovation Hackathon 2026**.

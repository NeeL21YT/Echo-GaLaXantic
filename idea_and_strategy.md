# Echo — Idea and Strategy

**Team GaLaXantic · Orbix 48-Hour Global Open Innovation Hackathon · Makers Need More (MnM)**

> Echo is a free, browser-based practice space where blind people learn human echolocation safely. You click, Echo computes how that click would bounce around a virtual room, and you hear every echo in 3D. Five levels each teach one skill. Training wheels slow the echoes down until you can hear them at real speed.

---

## 1. The problem

Some blind people use **click-based echolocation**. They make a sharp tongue click and listen to how it bounces off walls, doorways, cars and poles. Skilled echolocators can tell where things are, roughly how big they are, and even what they're made of.

The skill is **learnable, valuable and almost impossible to get trained in**.

- **Learnable.** In a 10-week Durham University study, blind and sighted adults aged 21–79 trained over 20 sessions. Both groups improved substantially, some reached expert level, and neither age nor blindness limited learning. [1]
- **Valuable.** At the 3-month follow-up, all blind participants reported improved mobility. [1] In a separate survey, blind people who echolocate reported higher mobility in unfamiliar places. [2]
- **Hard to access.** Click-based echolocation is not part of standard mobility training. [1] The few instructors who teach it work in person, and practising on real streets is unsafe for beginners.
- **Today's tech doesn't build the skill.** Apps that speak object names describe the world for you. When the phone dies or the app fails, nothing is left.

**Scale (India):** about 53 million people with vision impairment, including 6.8 million who are blind (WHO 2010 estimates, as cited in [3]). Assistive technology in Indian schools for the blind is largely limited to Braille slates, styluses and abacuses. [3] Echo's addressable users are the subset who are blind or have severe low vision, have normal hearing, and have a laptop and headphones.

## 2. Who it's for

| User | Need | What Echo gives them |
|---|---|---|
| **Blind / severe low-vision learner** (primary, cane user) | Practise privately, know if they heard it right, have a clear next step | Levels, instant spoken feedback, replay and A/B contrast, training wheels |
| **Orientation & mobility trainer** | Show what an echo cue is; check a learner's progress | Observer view (rays visible) and per-level scores |
| **Family / sighted learner** | Understand the skill and try it themselves | Same app, eyes closed |

## 3. The solution

1. **Click.** Press Space, or make a real tongue click into the mic.
2. **Ray cast.** 72 rays (one every 5°) go out through a virtual 2D room, up to 8 m.
3. **Build echoes.** Each hit gets its own delay, loudness and tone, based on distance and angle.
4. **Hear in 3D.** HRTF spatial audio places every echo around your head.

**A gap returns no echo.** That silence is the doorway, which is the key insight Level 3 teaches.

### The echo engine (simplified by design)
```
delay  = 2d / 343 × stretch
gain   = r × cosθ × 0.5 / (2d)      (spherical spreading, normalised at 0.5 m)
cutoff = 9000 / (1 + d)             (far echoes sound duller)
```
The model has 72 rays, an 8 m range and at most 24 merged echo voices. It is 2D with no diffraction. Echo trains **attention to echo cues** — direction, delay and gaps — rather than reproducing real acoustics perfectly.

### Training wheels
Real echoes from walls 1–3 m away return in 6–18 ms, too fast for a beginner to separate. Echo stretches the delays from 1× up to 8×. Levels start at 4×. After 3 passes in a row, Echo suggests going closer to real speed.

### Five levels, one skill each
| Level | Skill | Action | Pass |
|---|---|---|---|
| 1. Which side? | Direction | ← or → | 8/10 |
| 2. Near or far? | Distance | 1 or 2 | 8/10 |
| 3. Find the door | Gaps are silent | Turn, Enter when facing the door | Within ±20° |
| 4. The pole | Small objects | Walk to the end | No collision |
| 5. Escape | Combined | Walk the L-corridor | Exit in under 90 s |

Collisions play a soft bump. There are no harsh fail screens.

### The instructor loop (what makes it training, not a game)
After every answer, Echo:
1. Says whether you were right and **which cue to listen for** ("The wall was on your left; its echo arrives a little earlier and louder in your left ear").
2. Lets you **replay** the exact same sound.
3. Plays a **contrast**: the same scene without and with the object, or without and with the gap.

This is the feedback a self-learner never gets by clicking at a real wall alone.

### Two views
- **Blind view:** black screen, big text, everything spoken, full keyboard and button control. It works with a screen reader.
- **Observer view:** the rays light up what they hit, and the rays that escape through a gap visibly return nothing. Trainers, family and judges can see what the learner hears.

### Tech
React, Vite, TypeScript, Web Audio API, Canvas 2D, Web Speech API and Vercel. There is no backend and no ML. It runs offline after the first load, so nothing can break on demo day because of an API.

## 4. Why it's different

| Existing | What it is | How Echo differs |
|---|---|---|
| EchoLearn (Parsons, 2021) [4] | Mobile VR echolocation course with virtual clicks and multiple-choice exercises | Echo runs in any desktop browser with headphones, accepts a real tongue click, explains the cue after every answer with an A/B contrast, and uses time-stretch training wheels |
| EchoExplorer (Georgia Tech) [5] | Game app for learning echo cues | Echo is built as a graded curriculum with explicit pass rules and an observer view for trainers |
| Eyedar [6] | LiDAR-driven soundscape (pitch and volume encode objects) | That is sensory substitution through a device. Echo trains the human's own click-and-echo skill, which keeps working without any device |

**Positioning:** most accessibility projects describe the world. Echo trains the person to perceive it.

## 5. Honest limits (we say these out loud)
- The 2D model has no diffraction or real reverb. It trains attention to cues, not full acoustic realism.
- Transfer from headphone practice to real-world echolocation is a hypothesis that needs testing with blind learners and O&M trainers.
- Echo **complements the long cane**; it does not replace it. In Thaler's survey, every echolocator also used a cane. [2]
- Practice is seated. Echo is not a navigation aid.
- It needs headphones. Wired headphones are the tested setup.

## 6. Impact path
1. **Hackathon:** a working, deployed prototype, with blindfolded team tests of all five levels.
2. **Next 1–3 months:** usability sessions with blind learners via the National Association for the Blind or similar groups. The question is whether learners can start, practise and understand the feedback on their own.
3. **Then:** a fixed assessment block on unseen scenes, a comparison of reference click vs own click, and a small real-world study with an O&M trainer.
4. **Roadmap:** phone head-tracking, real floor plans (practise your own home or school), material levels (glass, curtain, concrete), outdoor scenes (parked cars, poles, junctions) and a trainer dashboard.

**Cost to users:** free. Any browser, headphones only.

## 7. Judging criteria map (Round 1: problem relevance, innovation, feasibility, impact)
| Criterion | Our evidence |
|---|---|
| Problem relevance | Peer-reviewed learnability and mobility benefit [1][2]; training is scarce; India scale [3] |
| Innovation | Gap-as-silence teaching; time-stretch training wheels; instructor loop with A/B contrast; a real tongue click as input |
| Feasibility | Fully built in 36 h on browser-native APIs. No backend, no ML, offline. Live URL |
| Impact | Free and needs only headphones. Builds a skill that outlives any device. Clear validation path with O&M trainers |

## 8. Demo script (3 minutes)
1. **(0:00–0:25) Hook.** "Close your eyes. You're in a room with a door somewhere. Without sight, how do you find it? Some blind people do it with a click."
2. **(0:25–0:50) Problem.** Echolocation is learnable in 10 weeks, but almost nobody can get trained, and the streets are unsafe to practise on.
3. **(0:50–1:50) Live.** Split screen, with a blindfolded teammate:
   - Level 1: click, answer, hear the feedback.
   - Press C for the contrast ("without… with").
   - Level 3: turn and click until one side goes quiet, then press Enter.
   - The observer view shows the rays escaping through the gap.
4. **(1:50–2:20) How.** 72 rays, three formulas, HRTF, and training wheels from 4× down to 1×.
5. **(2:20–2:45) Honesty and impact.** It complements the cane; it is simplified by design. Next comes testing with blind learners and O&M trainers.
6. **(2:45–3:00) Close.** "Echo trains the human to perceive the world on their own."

**If judges try it:** give them headphones first, use the Space click, start at Level 1 at 4×, and give them 5 trials, not 1 (one right answer can be chance).

## 9. Pitch wording rules
- Say **"works alongside the cane"**, never "canes don't train".
- Say **"realistic, simplified 2D model"**, never "correct" or "accurate acoustics".
- Say **"8 out of 10, previously 6"**, never percentages without a base.
- Don't claim proven learning from the app. Cite the Durham study for learnability and present Echo as the practice tool that study implies is missing.

## 10. Q&A prep
- **"Doesn't this exist already?"** EchoLearn and EchoExplorer showed virtual echolocation practice is possible. Echo adds the gap-as-silence curriculum, time-stretch training wheels, a feedback-and-contrast loop after every answer, real tongue-click input, and it runs in any browser.
- **"Does it transfer to the real world?"** Unknown yet, and that is our next step. The research shows virtual echo paradigms are valid enough that blind experts can perform them without training. [7]
- **"Why not just use object-detection apps?"** They help, and Echo isn't against them. But they replace perception, while Echo builds it. The skill still works when the battery dies.
- **"Why browser, not VR?"** Cost and reach. Headphones and any laptop are enough.
- **"Isn't clicking in public embarrassing?"** That's another reason to practise privately first.

## Sources
1. Norman, Dodsworth, Foresteire, Thaler (2021). Human click-based echolocation: Effects of blindness and age, and real-life implications in a 10-week training program. *PLOS ONE* 16(6): e0252330. https://doi.org/10.1371/journal.pone.0252330
2. Thaler (2013). Echolocation may have real-life advantages for blind people: an analysis of survey data. *Frontiers in Physiology* 4:98. https://pubmed.ncbi.nlm.nih.gov/23658546/
3. Assistive technology for visual impairment in schools for the blind in India (PMC10155581). https://pmc.ncbi.nlm.nih.gov/articles/PMC10155581
4. EchoLearn, Parsons MFA DT 2021. https://parsons.edu/dt-2021/echolearn/
5. EchoExplorer: A Game App for Understanding Echolocation and Learning to Navigate Using Echo Cues, Georgia Tech. https://repository.gatech.edu/entities/publication/dbd74c26-bc69-4ce5-bbe2-a352b74621c7
6. Eyedar. https://eye-dar.com/
7. Virtual echolocation navigation training in sighted people, validated with blind experts (PMC7033557). https://pmc.ncbi.nlm.nih.gov/articles/PMC7033557
8. Thaler et al. (2017). Mouth-clicks used by blind expert human echolocators. https://pmc.ncbi.nlm.nih.gov/articles/PMC5578488/

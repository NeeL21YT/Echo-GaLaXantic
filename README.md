# Echo — Project Docs Bundle

**Team GaLaXantic · Orbix 48-Hour Global Open Innovation Hackathon (Makers Need More, 21–23 Nov 2026)**

Echo is a free, browser-based practice space where blind people learn human echolocation. The player clicks (the Space key or a real tongue click), Echo ray-casts that click through a virtual 2D room, and every echo plays in 3D through headphones. Five levels each teach one skill. "Training wheels" slow the echoes down, then return them to real speed.

This bundle holds everything Claude Code needs to build Echo, and everything the team needs to pitch it.

---

## Files in this bundle

| File | Who reads it | What's in it |
|---|---|---|
| `README.md` | Everyone, first | This file: what each document is, where things live, how to start |
| `CLAUDE.md` | Claude Code, every session | Rules Claude follows for the whole build: fixed stack, dependency ban, echo-model rules, accessibility rules, text rules, testing, report format, feature freeze, decisions log |
| `build_spec.md` | Claude Code + all devs | **The main document.** Architecture, folder structure, every constant, engine formulas, audio graph, mic detection, five level definitions, feedback loop, state machine, UI/accessibility, tests, the build segments with task checklists and owners, cut order, definition of done |
| `idea_and_strategy.md` | Team, judges, repo visitors | **The flagship document.** Problem with sources, who it's for, solution, the engine in plain words, differentiation from existing apps, honest limits, impact path, judging-criteria map, 3-minute demo script, pitch wording rules, Q&A prep, references |
| `claude_code_prompts.md` | Whoever drives Claude Code | Copy-paste prompts P0–P8, one per build segment, plus utility prompts for gate tuning, bug fixes, spec checks and pitch explanations |

## Where to find specific things

| Looking for | Go to |
|---|---|
| Echo formulas (delay, gain, cutoff) | `build_spec.md` §5.3 · `idea_and_strategy.md` §3 |
| Every tunable number | `build_spec.md` §4 (becomes `src/config.ts`) |
| Level rules and pass conditions | `build_spec.md` §7.2 |
| What the feedback says after an answer | `build_spec.md` §7.3 |
| Key map and buttons | `build_spec.md` §9.2–9.3 |
| Screen reader vs voice narration | `build_spec.md` §9.4 · `CLAUDE.md` Accessibility rules |
| Who builds what, and when | `build_spec.md` §11 |
| The hour-10 blindfold gate | `build_spec.md` §10.2 |
| What to cut if we're late | `build_spec.md` §11, "Cut order" |
| Pitch script and Q&A | `idea_and_strategy.md` §8–10 |
| Wording we must avoid | `idea_and_strategy.md` §9 |
| Research sources | `idea_and_strategy.md` Sources |

## How to start the build

1. Create an empty repo named `echo`.
2. Place the files:
   ```
   echo/
   ├── CLAUDE.md
   ├── README.md                 ← replaced by the project README in prompt P8
   └── docs/
       ├── build_spec.md
       ├── idea_and_strategy.md
       └── claude_code_prompts.md
   ```
3. Open Claude Code in `echo/` and paste **P0** from `claude_code_prompts.md`.
4. Continue with P1–P8 in order. P1/P2/P3 and P5/P6 can run in parallel on separate branches (owners in `build_spec.md` §11).
5. After every prompt, do the manual check Claude lists, then commit as `seg<N>: <what>`.
6. At about hour 10, run the blindfold gate. If it fails, use **P4b** before building anything else.
7. Feature freeze at hour 29. After that, use the bug-report prompt only.

## Team roles

| Role | Owns |
|---|---|
| A — Audio engineer | Click, offline render, HRTF, limiter, mic detection, SFX |
| B — Geometry and levels | Ray caster, echo builder, collisions, worlds, Levels 1–5 |
| C — Visuals and UX | Observer view, blind view, controls, onboarding, settings, progress |
| D — Integration and pitch | Scaffold, deploy, blind tests, README, slides, demo video |

## Tech at a glance
React 18 · Vite · TypeScript · Web Audio API (HRTF panner, OfflineAudioContext) · Canvas 2D · Web Speech API · Zustand · Vitest · Vercel. No backend, no ML, and it works offline after the first load.

## Ground rules
- `build_spec.md` wins over everything except a deliberate team decision. Log such decisions in `CLAUDE.md` § Decisions log.
- Echo complements the long cane. It is a seated practice tool, not a navigation aid, and it is simplified by design. Say so in the app, the README and the pitch.

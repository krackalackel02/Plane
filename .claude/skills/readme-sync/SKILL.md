---
name: readme-sync
description: Use after making an architectural change to this repo — new tooling, a changed build/CI process, a new top-level directory or major component category — to check whether README.md needs updating and update it. Not for routine content changes (a new component, a tweak to an existing scene/animation, a bug fix) — those never touch README.md.
---

# README sync

Keeps `README.md` from going stale as the repo's actual tooling and
structure change. README.md should stay a brief orientation for a person
glancing at the repo on GitHub — what this project is and how it's built —
not a full technical reference.

Note: as of the last check, this repo's `README.md` is still the stock
Vite/React template text (generic scaffolding boilerplate), not a
description of this actual project (a Three.js/React-Three-Fiber plane
scene, per `src/components/`). The first real use of this skill should
probably replace that boilerplate with an actual description, not just
patch around it.

## What counts as "architectural" (update README) vs. routine (don't)

**Update README for:**
- A new major piece of tooling or dependency category (adding physics,
  multiplayer/networking, a state-management library, a new testing
  framework).
- A changed build/deploy process (a new required Node version, a change to
  how the GitHub Pages deploy in `.github/workflows/main.yaml` works, a new
  required env var beyond `VITE_SHOW_*`).
- A new top-level directory with a lasting structural purpose (a new
  `src/` subdirectory category alongside `components/context/utils/test`,
  a new `scripts/` utility, `.claude/skills/`).
- Anything that would make the current README's description of "what this
  repo is and how it's organized" actively wrong or meaningfully
  incomplete.

**Don't touch README for:**
- A new component within an existing category (`src/components/<feature>/`),
  or a tweak to an existing one's behavior/visuals.
- A bug fix, refactor, or perf change with no visible change to what the
  project does or how someone would build/run it.
- A new feature branch or PR in progress — README reflects `main`, not
  work-in-progress branches.
- A new skill added to `.claude/skills/` (mention once that a skills system
  exists if it isn't mentioned at all yet; don't enumerate every skill).

## Workflow

1. After making a change, ask: does this change what a first-time visitor
   reading README.md would need to know to understand, build, or run this
   repo? If no, stop here.
2. Read the current `README.md` in full.
3. Update it minimally — add or adjust the specific stale part, don't
   rewrite the whole thing unless it's genuinely all out of date (as it
   currently is, being template boilerplate). Keep it short: what the
   project is, how to run it (`npm install`, `npm run dev`/`npm run build`),
   and a couple of lines on structure — not a section-per-feature essay.
4. Match a casual, first-person tone once real content replaces the
   boilerplate, rather than a formal enterprise README template style.

## Hard rule

Never let README.md grow into a full technical reference. If an update
would take more than a few lines, it belongs in code comments or a
skill's own reference file, with just a one-line pointer added to README
instead.

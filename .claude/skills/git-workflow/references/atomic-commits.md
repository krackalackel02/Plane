# Worked example: splitting a real mixed batch

This is the actual uncommitted state of the repo as of 2026-09-21, used as a
live example rather than a hypothetical:

```
 M package-lock.json
 M package.json
 M src/components/scene.tsx
?? .claude/skills/git-workflow/**
?? .claude/skills/readme-sync/**
```

## The grouping

1. `.claude/skills/git-workflow/**` + `.claude/skills/readme-sync/**` —
   repo-tooling documentation for coding agents. No code coupling to
   anything else in this batch, and no coupling between the two skills
   themselves either — commit together as one "add agent skills" commit, or
   split if they were added at genuinely different times.
2. `package.json` + `package-lock.json` — if these changed together because
   a dependency was added/bumped, commit as a pair; lockfile drift without a
   matching `package.json` change (or vice versa) is a red flag worth
   checking (`npm install` was run against a different lockfile state)
   before committing either.
3. `src/components/scene.tsx` — a behavioral/content change to the actual
   3D scene. Unrelated to the tooling docs and (usually) to a dependency
   bump — own commit, unless the dependency bump was specifically *for*
   this scene change (e.g. adding a new `@react-three/*` package that
   `scene.tsx` now imports), in which case group it with #2.

Note what makes this batch easy: **the tooling docs are pure new files with
zero build dependency** — they can be committed in any order relative to
everything else. The only real dependency question is whether the
`package.json`/lockfile change and the `scene.tsx` change are the same
piece of work or two unrelated ones; check `git diff` on `package.json` to
see whether a new dependency import appears in `scene.tsx` before deciding.

## The case that actually needs the buildability check

That's not true for every batch. If a session had instead added a new
shared hook or context value (say, `src/context/ShipState.tsx`) *and* a
component that consumes it (`src/components/ship/Ship.tsx`), those two
changes are coupled: the component's commit is only valid if the context
commit already landed. In that case:

- **Do**: commit the new context/hook and its first consumer together (or
  context first, consumer second — never consumer first).
- **Don't**: split them into "add ShipState context" and "use ShipState in
  Ship component" as two commits where the second could conceivably be
  reordered or cherry-picked without the first — if that ever happens, the
  component's commit alone won't typecheck or build.
- **Verify**: run `npx tsc -b --noEmit` (or `npm run build`) after staging
  the combined change, before committing — don't assume it's fine because
  the types "look right."

The general rule: group by *build dependency*, not just by directory. Two
files in the same folder can be fully independent (most sibling components
under `src/components/<feature>/`); two files in different folders can be
tightly coupled (a shared context and its first consumer). Check which
situation you're actually in before splitting.

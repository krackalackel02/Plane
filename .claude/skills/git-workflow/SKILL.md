---
name: git-workflow
description: Use when committing changes in this repo, especially a large batch of untracked/modified files that need splitting into sensible commits, or when deciding between branching, merging, and rebasing. Keeps commits independently scoped by purpose and ordered so the project still builds/tests at every commit boundary rather than only at the final one. Matches this repo's existing terse, unprefixed commit-message style rather than imposing an unrelated convention.
---

# Git workflow

Two concerns: **splitting a messy working tree into commits that each make
sense on their own**, and **choosing a sane branch/merge/rebase strategy**
when one is warranted. This repo uses short-lived feature branches (named
after the feature: `camera`, `timeline`, `ship`, `mobile`, `3js`, ...) merged
into `main` via GitHub PR, with terse, unprefixed, lower-key commit messages
within a branch (`"fix"`, `"refactor"`, `"fixed unit test"`, `"leva controls
for ship physics"`) — match that tone; don't impose Conventional Commits or
similar onto a repo that's never used it.

## Splitting a large uncommitted batch

This is the case to actively watch for: a session touches several unrelated
areas (a component, shared utils/context, build config, `.claude/` tooling)
and everything ends up uncommitted at once. Don't commit it as one blob.
Work through this order:

1. **Inventory.** `git status --porcelain=v1 --untracked-files=all` — don't
   trust the default `git status` for a repo with untracked directories,
   it'll collapse a whole new folder into one line and hide what's inside.
2. **Group by concern, not by chronology.** Typical areas in this repo:
   a single component or feature under `src/components/<feature>/`, shared
   code (`src/context/`, `src/utils/`), build/tooling config (`package.json`,
   `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.github/workflows/`,
   `.husky/`), and repo docs/tooling (`.claude/**`, `README.md`,
   `.gitignore`). Each becomes its own commit (or a few, if one area has
   genuinely separate changes within it).
3. **Order by dependency, not alphabetically.** A util, hook, or context
   value used by a component must be committed at the same time as, or
   before, the component that calls it — never after. Pure-documentation
   additions (`.claude/**`, `README.md`) have no build dependency at all and
   can go in any order, including first.
4. **Check buildability at each proposed boundary**, not just at the end.
   TypeScript/ESLint are strict about *unused* new exports far less than
   about a caller that references something not yet committed — the real
   risk is a commit that *uses* a component, hook, or type that a
   later, not-yet-made commit was supposed to introduce. Run `npm run build`
   and `npx tsc -b --noEmit` (or `npm run lint`) after staging each proposed
   group (via a scratch commit or `git stash` if checking a hypothetical
   intermediate state) when a change is genuinely coupled across files; skip
   this check for changes with no code involvement at all (pure `.claude/`
   docs, `.gitignore`, README wording).
5. **Never `git add -A`/`git add .` on a mixed batch.** Stage explicitly
   per group (`git add <files for this group>`, or `git add -p` if one file
   mixes concerns), review with `git status`/`git diff --cached` before
   each commit, then commit with a message matching the group's actual
   scope.

See `references/atomic-commits.md` for a full worked example, using this
repo's own state as a real case.

## Commit messages

Match the existing style: short, imperative-ish, lower-key phrasing (`"fixed
logger"`, `"added dev and prod modes"`, `"working jet switching and
turning"`), not `"feat(scene): implement jet switching state machine"`. Say
what changed in plain terms; a body line explaining *why* is welcome when
the reason isn't obvious from the diff, but isn't mandatory for a one-line
tweak (this repo's history doesn't do that for small changes either).

When a feature branch is merged into `main` via a GitHub PR, the PR
title/squash-commit message (e.g. `"Camera (#5)"`, `"Timeline (#4)"`) is a
short capitalized feature name plus GitHub's auto-appended PR number —
that's the platform's convention for the merge commit, distinct from the
terse in-branch commit style above. Don't hand-craft a fancier PR title than
that pattern.

## Branch, merge, and rebase strategy

This repo works in per-feature branches (`camera`, `timeline`, `ship`,
`mobile`, `background`, `3js`, `plane`) merged back into `main` through a
GitHub PR — almost always squash-merged (one commit per PR on `main`), with
one early exception where a real merge commit was used. `.github/workflows/pr.yaml`
runs `npx vitest --run` on any PR not targeting `main`; `.github/workflows/main.yaml`
runs tests, builds, and deploys to GitHub Pages on `main`. Locally, Husky's
`pre-commit` hook runs `lint-staged` (prettier + eslint --fix, so files may
get reformatted on commit) and `pre-push` runs `npm run test` — a push with
failing tests is blocked before it reaches CI.

See `references/branch-merge-strategy.md` for the decision points: when a
branch is worth creating (any new feature, per this repo's existing
pattern) versus committing directly to a branch you're already on for a
small fix, rebase-before-merge for a clean linear history, and how to
handle a real merge conflict.

## Hard rules (on top of standing git safety rules)

- Never rewrite history that's already been pushed, and never force-push,
  without the user explicitly asking for that specific action.
- Don't invent a commit-message or PR-title convention this repo has never
  used.
- There is no `gh` CLI or GitHub token configured in this environment —
  don't fabricate a way to query remote CI/PR status. If that's needed,
  point the user at the Actions tab
  (`https://github.com/krackalackel02/Plane/actions`) or ask them to check,
  rather than guessing at remote state.

## Reference files

- `references/atomic-commits.md` — worked example of splitting a real mixed
  batch of changes into buildable, independently-scoped commits.
- `references/branch-merge-strategy.md` — when to branch, rebase vs. merge,
  fast-forward guidance, and conflict handling for this repo.

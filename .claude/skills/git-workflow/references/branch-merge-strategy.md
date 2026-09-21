# Branch, merge, and rebase strategy

## When to branch at all

This repo's whole history is feature branches (`camera`, `timeline`,
`ship`, `mobile`, `background`, `3js`, `plane`), each merged into `main` via
a GitHub PR once the feature works. Follow that pattern: a new feature or
any change you'd want to iterate on and validate (via `npm run dev`,
`npm run test`, `npm run lint`) before it's "done" gets its own branch
named after the feature, not committed straight to `main`.

Committing directly to whatever branch you're already on is fine for a
small, low-risk fix within that feature's scope (a typo, a quick bug fix
mid-feature) — it doesn't need a sub-branch of its own.

## Rebase vs. merge

- **Rebase a feature branch onto the latest `main` before merging it back**,
  to keep history linear and avoid an unnecessary merge commit. This repo's
  history is a squash-merge per PR already (one commit per feature landing
  on `main`, e.g. `"Camera (#5)"`), so there's rarely a real merge commit to
  worry about — GitHub's squash-merge does the equivalent of this
  automatically when you merge the PR.
- **Never rebase commits that have already been pushed** if there's any
  chance someone else (or another machine) has already pulled them. If the
  branch is genuinely still local/unpushed, rebasing freely is fine.
- The `.github/workflows/pr.yaml` check (`npx vitest --run`) must pass on
  the PR before it's safe to merge; the local Husky `pre-push` hook already
  runs `npm run test` so a broken push shouldn't reach CI in the first
  place, but don't assume that guarantee holds if `--no-verify` was ever
  used to bypass it.

## General conflict handling

Most conflicts here will be genuine concurrent edits to the same component
or shared file (two branches both touching `src/components/ship/Ship.tsx`,
or both bumping the same dependency in `package.json`) — resolve those the
normal way: read both sides, merge the intent rather than picking one
wholesale, and run `npm run build`/`npm run test` afterward to confirm the
resolved state actually compiles and passes.

For `package-lock.json` conflicts specifically, resolving by hand is
usually not worth it — take one side, then re-run `npm install` to
regenerate the lockfile consistently with the resolved `package.json`,
rather than hand-editing the generated file.

# E2E that actually runs, on its own data

## Problem

CI e2e hasn't run a test since ~2026-11-19. The AI test selection step ran out
of Anthropic credits, it is `continue-on-error`, so no files were selected and
the status still posted "All tests passed". A real regression slipped through
meanwhile: #279 renamed the puzzle page back link to "Go to home/puzzles" and
the page object still looked for "Back to …".

Even when it ran, CI tested the per-revision preview URL, which uses Deploy's
single preview database shared by every PR. Unique names stop tests colliding,
but leftover data keeps changing what a test actually checks (the high score
gets more crowded every run).

## Approach

**Test against the branch timeline, not the revision.** Deploy gives each git
branch its own KV database (`<app-id>--<branch>`), served at
`https://<app>--<branch>.<org>.deno.net`. CI points `BASE_URL` there. Deploy drops slashes from the branch name
(`fix/cookie-banner-copy` → `ricochet--fixcookie-banner-copy`). The branch URL
may still serve the previous revision when the deployment event fires, so CI
waits until it serves the commit under test.

**Start every run from an empty database.** A new e2e reset route deletes all
keys before the suite runs. Guards:

- `E2E_SECRET` is only set in Deploy's Development context, so the route is
  dead in production.
- It also refuses unless `DENO_TIMELINE` starts with `git-branch/`, so it can
  never empty the shared preview database. Locally `DENO_TIMELINE` is unset and
  each worktree already has its own KV file, so the reset works there too.
- The workflow's per-ref concurrency group means one run per branch at a time.

**Deterministic test selection.** Replace `scripts/select-e2e-tests.ts` (Claude
API) with an explicit classification: `e2e/selection.ts` maps globs to an
outcome, first match wins.

- `none`: can't change what a player sees (docs, specs, unit tests, scripts,
  puzzles).
- `full`: global, runs every test (entry points, config, middleware, layouts,
  all CSS, static assets).
- `dep`: follows the import graph (`deno info --json`): the nearest
  `routes/**/_e2e/` tests of affected routes, plus the `e2e/` flows.

A changed file matching no glob fails the check, so a new kind of file can't
slip through selecting nothing. Drop `continue-on-error`: a selection failure is
a CI failure, not a pass.

**Fix the stale back-link locator** so the suite is green before it gates PRs
(29/29 locally).

## Non-goals

- Leaving Deno Deploy (TODO #258); the reset route and branch-scoped data carry
  over to whichever host comes next.
- Parallelising test files or retrying flaky ones.

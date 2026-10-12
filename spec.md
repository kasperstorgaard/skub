# Returning-user e2e failures

Two tests in `e2e/returning-user-flow_test.ts` fail on PR previews. Paused
mid-investigation; this records what is known.

## Symptoms

- **JS, daily from home:** after solving the daily, `solutionsPage.backLink`
  → `puzzlePage.backLink` → home, the daily card has no "Perfect" label
  (`returning-user-flow_test.ts:25`). The solve itself works: the
  celebration opens and the name is on the solutions page.
- **No JS, archived puzzle:** fails before any solve. After
  `home.clickArchivesLink()`, the Archives heading is not found
  (`returning-user-flow_test.ts:41`).

## What is known

- e2e only runs on previews of non-draft PRs (`deployment_status`); `main` and
  drafts skip it, so most green runs since Oct 11 never ran these tests.
- JS test: passed on every `perf/profile-cookie` and `perf/progress-cookie`
  run (Oct 11, 10:00–12:00 UTC), failed on `feat/puzzles-37` (Oct 11, 19:40)
  and `perf/solve-post` (Oct 12, 19:53). Not the puzzle: neither failing
  branch has the new puzzles, so the daily falls back to `birk` (#284), the
  same one that passed. Not the solve-post change either, since
  `feat/puzzles-37` doesn't have it.
- No-JS test: flaky since #247. It failed once on #247's first commit
  (`4252876`), and passing runs take either ~8 s or ~34 s, which suggests a
  wait that sometimes times out.
- Both tests start with `asUser`, which seeds a KV user and sets only the
  `user_id` cookie, so the first request backfills the profile and progress
  cookies from KV.
- No artifacts: the e2e workflow uploads no traces or screenshots.

## Next steps

- Re-run the failed job to tell flake from a consistent failure.
- Upload Playwright traces on failure in `e2e.yml`, so the next failure shows
  the page.
- Check the "Perfect" path: `components/puzzle-card.tsx` labels by
  `isOptimal`, from the progress cookie's best moves. Does the cookie written
  on the JSON solve POST reach the home page after two back links?
- Check what the ~34 s no-JS runs wait on.

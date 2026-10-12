# Returning-user e2e failures

Two tests in `e2e/returning-user-flow_test.ts` failed consistently on PR
previews from Oct 12. Cause found; what is left is hardening.

## Cause

Two separate problems.

**No JS: the date (fixed by rebasing).** Branches cut before #254 end at
puzzle #284, and from Oct 12 today's slot is 285. The archives page opens on
today's date and throws `HttpError(500)` when today's slot has no puzzle
(`routes/puzzles/index.tsx`). Reproduced with curl on two previews; passes
once the branch is rebased on `main`.

**JS: the test, not the app.** After solving the daily, `backLink` twice
should land on home with "Perfect" on the daily card. It fails on every
branch that includes Fresh 2.3 (#249), including after the rebase, and passed
on every run before it; #249 never ran e2e (it was a draft). The same flow
works by hand on a preview, so players are unaffected: the test is out of
step with how navigation behaves since Fresh 2.3 (timing or navigation
mechanics). Not yet pinned down.

## Risk in production

The highest scheduled puzzle is #291 (Oct 18). From Oct 19, `/puzzles` returns
500 unless more puzzles land.

## Options

- Archives: when the selected date has no puzzle, render the month without a
  selected puzzle instead of throwing.
- e2e: upload Playwright traces on failure in `e2e.yml`, so the next failure
  shows the page. The workflow runs from `main` (`deployment_status`), so this
  only takes effect once merged.
- JS daily test: with traces, see what the page shows after the second
  `backLink` click under Fresh 2.3, then fix the test's wait or locator.
- The no-JS test still has slow passing runs (~34 s vs ~8 s); worth a look
  once traces exist.

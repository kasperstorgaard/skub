# Returning-user e2e failures

Two tests in `e2e/returning-user-flow_test.ts` failed consistently on PR
previews from Oct 12. Cause found; what is left is hardening.

## Cause

The branches were cut before #254, so their puzzles end at #284, and from
Oct 12 today's slot is 285. Nothing in the solve change caused it.

- **No JS:** the archives page opens on today's date and throws
  `HttpError(500)` when today's slot has no puzzle
  (`routes/puzzles/index.tsx`). Reproduced with curl on two previews; prod,
  which has #285, returns 200.
- **JS:** home falls back to the newest puzzle (`birk`, #284), but it isn't
  today's, so the puzzle page's back link goes to the archives instead of home
  and the test never sees the daily card again.

The JS failure on `feat/puzzles-37` (Oct 11, 19:40 UTC) doesn't fit: `birk`
was today's then. Likely the flake seen before.

## Risk in production

The highest scheduled puzzle is #291 (Oct 18). From Oct 19, `/puzzles` returns
500 unless more puzzles land.

## Options

- Archives: when the selected date has no puzzle, render the month without a
  selected puzzle instead of throwing.
- e2e: upload Playwright traces on failure in `e2e.yml`, so the next failure
  shows the page. The workflow runs from `main` (`deployment_status`), so this
  only takes effect once merged.
- The no-JS test still has slow passing runs (~34 s vs ~8 s); worth a look
  once traces exist.

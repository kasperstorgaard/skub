# Returning-user e2e failures

Two tests in `e2e/returning-user-flow_test.ts` failed consistently on PR
previews from Oct 12. Both are explained: one by the date, one by a race in
the test.

## Cause

Two separate problems.

**No JS: the date (fixed by rebasing).** Branches cut before #254 end at
puzzle #284, and from Oct 12 today's slot is 285. The archives page opens on
today's date and throws `HttpError(500)` when today's slot has no puzzle
(`routes/puzzles/index.tsx`). Reproduced with curl on two previews; passes
once the branch is rebased on `main`.

**JS: a race in the test.** The header has `f-client-nav`, so its Back link
navigates with Fresh partials (a `?fresh-partial=true` fetch and a swap of the
`body` partial, no page load). Playwright's `click()` doesn't wait for that, so
the second Back click landed on the solutions page's header, still on screen,
whose Back points to the puzzle page again. The trace shows two partial
requests for `/puzzles/kenneth` and the test ending there. It started with
Fresh 2.3 (#249) because the timing changed; by hand it works. Fix: wait for the
puzzle page (its controls' "See solves") before the second Back, and for the
home title after it.

## Risk in production

The highest scheduled puzzle is #291 (Oct 18). From Oct 19, `/puzzles` returns
500 unless more puzzles land.

## Options

- Archives: when the selected date has no puzzle, render the month without a
  selected puzzle instead of throwing.
- e2e evidence: traces (recorded per test, uploaded on failure) found the
  race above; removed again before merge. Re-add them the same way when a
  failure needs a look.
- The no-JS test still has slow passing runs (~34 s vs ~8 s); worth a look.

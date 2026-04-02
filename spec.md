# E2E test cleanup

## Problem

The last PR established the rule: tests must not bypass board interaction via
synthetic URL state. It fixed `PuzzlePage.solveByClicking()` to require `moves`
from outside. Two things remained:

1. `TutorialPage.solveByClicking()` still fetches the puzzle and solves
   internally — same anti-pattern, with a `// TODO` comment.
2. `PuzzlePage.solveByKeyboard()` had the same anti-pattern.
3. No tests exist for the archives page (`/puzzles`) despite it having a POM.
4. The testing skill lacked a clear, general statement of the integration test
   contract.
5. All puzzle integration tests used the same slug ("karla"), risking false
   positives from shared board state.

## Solution

### 1. Integration test contract (testing skill)

Formalise the contract in `.claude/skills/testing/SKILL.md`:

**Starting state**: must be one that _another page_ in the app could realistically
produce via a link, cookie, or KV write. Server-side seeding (`addSolution`,
`seedUser`) is fine — it mirrors what the app's own handlers write. URL params
that no other page would link to are not valid starting states, even if the app
generates them internally.

**End state**: a UI assertion, plus an optional assertion about the URL, cookie,
or KV state the next page will pick up.

Page object methods must not encapsulate solving logic — moves come from the
caller via `solvePuzzle(slug)`, POMs are thin wrappers. This applies to all
solve methods: `solveByClicking(moves)` and `solveByKeyboard(moves)`.

Flow tests (`e2e/`) cover valuable multi-page journeys where a breakage is a
critical user-facing error. Integration tests (`routes/*/_e2e/`) cover individual
page behaviour.

### 2. Fix `TutorialPage.solveByClicking()`

Change signature to `solveByClicking(moves: Move[])`. Remove the internal
`getPuzzle` / `solveSync` call. Remove unused imports.

Update callers:
- `routes/puzzles/tutorial/_e2e/tutorial_test.ts` — add `solvePuzzle("tutorial")`, pass moves
- `e2e/new-user-flow_test.ts` — add `solvePuzzle("tutorial")`, pass moves

### 3. Spread puzzle integration tests across multiple slugs

Each test in `puzzle_test.ts` now uses a distinct puzzle slug and a distinct
e2e user, so no two tests share board state or KV user data:

| Test | Puzzle | User |
|------|--------|------|
| returning player sees celebration dialog | karla | e2eliza |
| no-JS returning player submits solve | heino | e2edna |
| returning player submits duplicate solve | laerke | e2ebbe |
| new player solves by keyboard | jurgen | — |
| new player is prompted to save | alice | — |
| new player submits name → solutions page | brian | e2eleanor |

### 4. Archives page tests

New file: `routes/puzzles/_e2e/archives_test.ts`

Three tests:
1. renders the heading
2. navigates to the next page
3. puzzle card links to a puzzle page

## Files

- **modified** `.claude/skills/testing/SKILL.md` — add integration test contract section
- **modified** `routes/puzzles/tutorial/_e2e/tutorial-page.ts` — `solveByClicking(moves: Move[])`, remove internal solve logic
- **modified** `routes/puzzles/[slug]/_e2e/puzzle-page.ts` — `solveByKeyboard(moves: Move[])`, remove internal `getPuzzle`/`solveSync`
- **modified** `routes/puzzles/[slug]/_e2e/puzzle_test.ts` — `solveByKeyboard` gets moves from caller; tests spread across karla/heino/laerke/jurgen/alice/brian with unique e2e users
- **modified** `routes/puzzles/tutorial/_e2e/tutorial_test.ts` — add `solvePuzzle` calls, pass moves
- **modified** `e2e/new-user-flow_test.ts` — add `solvePuzzle("tutorial")`, pass moves
- **new** `routes/puzzles/_e2e/archives_test.ts` — 3 basic archives page tests

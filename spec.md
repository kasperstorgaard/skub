# Tutorial rework + multi-step onboarding

## Problem

The old onboarding was a single-state toggle (`new` → `done`) tied to puzzle-solving
efficiency. First-time players got a tutorial, then immediately saw the daily puzzle
with no scaffolding. There was no guided path from "just learned the rules" to "ready
for a real puzzle".

## Solution

A multi-step onboarding flow with dedicated puzzle files per stage, tracked in the
`Onboarding` state machine on the user record:

```
new → (completes tutorial) → started → (solves lars) → progressing → (solves lone) → done
```

Graduation via a good daily solve is still a fallback path for users who skip straight
to the daily.

### Onboarding state machine

| State | Meaning | Home page shows |
|---|---|---|
| `new` | Never started | Tutorial CTA card |
| `started` | Finished tutorial dialog | "lars" (starter puzzle) |
| `progressing` | Solved lars | "lone" (graduation puzzle) |
| `done` | Graduated | Random puzzle |

### New puzzle files

- `static/puzzles/lars.md` — `onboarding: started`, easy 4-move puzzle shown as "Starter puzzle"
- `static/puzzles/lone.md` — `onboarding: progressing`, shown as "Graduation puzzle"
- `static/puzzles/tutorial.md` — unchanged, loaded via `getOnboardingPuzzle("new")`

### Loader changes (`game/loader.ts`)

- `number` is now optional on puzzles — onboarding puzzles have no number
- `getAvailableEntries` / `getFutureEntries` / `listPuzzles` / `getDifficultyBreakdown` / `getRandomPuzzle` all filter `!entry.onboarding` so onboarding puzzles never appear in regular listings
- New `getOnboardingPuzzle(state)` fetches the puzzle matching a given onboarding state

### Home page (`routes/index.tsx`)

- `randomPuzzle` is now `Puzzle | null` — only shown when `onboarding === "done"`
- New `onboardingPuzzle` field: resolved via `getOnboardingPuzzle` when user is `started` or `progressing`
- `bestMoves` filter is null-safe

### Puzzle solve handler (`routes/puzzles/[slug]/index.tsx`)

Three distinct graduation paths:
1. Solving `lars` (`onboarding === "started"`) → advances user to `progressing`
2. Solving `lone` (`onboarding === "progressing"`) → advances to `done` + fires `player_graduated`
3. Solving any daily with ≤ 133% optimal moves while not yet `done` → advances to `done` + fires `player_graduated`

### Tutorial route (`routes/puzzles/tutorial/index.tsx`)

- Loads puzzle via `getOnboardingPuzzle("new")` instead of hardcoded slug
- "Rather watch?" button extracted to `TutorialWatchButton` island — only renders after 3+ moves
- Fires `trackTutorialCompleted` on valid solve

### Tutorial dialog (`islands/tutorial-dialog.tsx`)

- Copy rewrite: clearer language, less jargon
- Arrow icons added to Previous/Next navigation
- "How it works" step renamed; welcome step now links "Home" instead of "Dismiss"
- Replay step simplified: removed "Show again" link, updated copy

### Tracking (`lib/tracking.ts`)

- `trackOnboardingCompleted` → renamed `trackTutorialCompleted` (fires when tutorial dialog is completed)
- New `trackPlayerGraduated` (fires when user transitions to `done`)

### Minor

- `solution-dialog.tsx`: copy tweaks ("Save", "Play again"), `autocomplete="username"`, removed "Close" button
- `celebration-dialog.tsx`: "Start over" → "Play again"
- `puzzle-card.tsx`: `number` rendered conditionally (undefined-safe)
- `routes/_app.tsx`: `"daily"` removed from OG image exclusion list
- `routes/puzzles/index.tsx`: `"tutorial"` removed from `excludeSlugs` (loader filter handles it now)

## Files

- **modified** `game/types.ts` — `Onboarding` type, `Puzzle.number` optional, `Puzzle.onboarding` field, `PuzzleManifestEntry` updated
- **modified** `game/loader.ts` — onboarding filtering, `getOnboardingPuzzle`
- **modified** `lib/manifest.ts` — `onboarding` field in manifest, sort null-safe
- **modified** `lib/tracking.ts` — renamed + new tracking functions
- **modified** `routes/index.tsx` — home page onboarding branching
- **modified** `routes/puzzles/[slug]/index.tsx` — multi-path graduation logic
- **modified** `routes/puzzles/tutorial/index.tsx` — `TutorialWatchButton`, `trackTutorialCompleted`
- **modified** `routes/puzzles/index.tsx` — removed hardcoded tutorial exclusion
- **modified** `routes/_app.tsx` — OG exclusion list
- **modified** `islands/tutorial-dialog.tsx` — copy + navigation icons
- **modified** `islands/solution-dialog.tsx` — copy + input autocomplete
- **modified** `islands/celebration-dialog.tsx` — copy
- **modified** `components/puzzle-card.tsx` — null-safe number
- **added** `islands/tutorial-watch-button.tsx` — extracted "Rather watch?" island
- **added** `static/puzzles/lars.md` — starter onboarding puzzle
- **added** `static/puzzles/lone.md` — graduation onboarding puzzle

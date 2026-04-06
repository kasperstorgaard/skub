# Tutorial rework + skill level system

## Problem

The old onboarding was a single-state toggle (`new` → `done`) tied to puzzle-solving
efficiency. First-time players got a tutorial, then immediately saw the daily puzzle
with no scaffolding. There was no model for how capable a player actually is.

## Solution

Replace the onboarding state machine with a **skill level** on the user record and a
sequence of onboarding puzzles ordered by `onboardingLevel`. Skill is earned through
play, not just by completing steps.

### Skill level (`User.skillLevel: SkillLevel | null`)

| Level | Earned by | Home page shows |
|---|---|---|
| `null` | Default (unknown) | Tutorial CTA |
| `"beginner"` | Completing tutorial, or first puzzle solve (skip path) | Next unsolved onboarding puzzle, or random if all done |
| `"intermediate"` | Medium puzzle solved within 1.33× optimal | Random puzzle |
| `"expert"` | Medium or hard puzzle solved perfectly | Random puzzle |

Promotions only move upward. `trackSkillLevelUp` fires (with `$set: { skill_level }` for PostHog person profile) on intermediate/expert promotions. `trackTutorialCompleted` sets `$set: { skill_level: "beginner" }` on the profile.

### Onboarding puzzles

Puzzles tagged with `onboardingLevel: number` in frontmatter are filtered from all regular listings. The home page shows the first unsolved one (level > 1) to `"beginner"` users.

| Level | Slug | Tagline |
|---|---|---|
| 1 | `tutorial` | — (separate route) |
| 2 | `lars` | "Starter puzzle" |
| 3 | `lone` | "Quick puzzle" |

### Loader (`game/loader.ts`)

- `Puzzle.number` is now optional — onboarding puzzles have no number
- All listing functions (`getAvailableEntries`, `getFutureEntries`, `getRandomPuzzle`, etc.) filter `!entry.onboardingLevel`
- `getTutorialPuzzle()` — fetch level 1 puzzle
- `getOnboardingPuzzle({ excludeSlugs })` — next unsolved puzzle at level > 1, or null if all solved

### Home page (`routes/index.tsx`)

- `skillLevel === null` → tutorial CTA (no puzzle loaded)
- `skillLevel === "beginner"` → `getOnboardingPuzzle({ excludeSlugs: solvedSlugs })`; falls through to random if null
- `skillLevel !== null && !== "beginner"` → random puzzle (difficulty filtered: `expert` gets easy/medium/hard, others get easy/medium)
- `onboardingPuzzle` and `randomPuzzle` are mutually exclusive — random only loaded when onboarding is null

### Puzzle solve handler (`routes/puzzles/[slug]/index.tsx`)

Skill promotion checks run on every new solve (checked in order, first match wins):

1. Medium/hard + `moves === minMoves` + not already expert → `"expert"` + `trackSkillLevelUp`
2. Medium + `moves ≤ minMoves * 1.33` + not intermediate/expert → `"intermediate"` + `trackSkillLevelUp`
3. `skillLevel === null` → `"beginner"` (silent, skip-tutorial path)

### Tutorial route (`routes/puzzles/tutorial/index.tsx`)

- Loads puzzle via `getTutorialPuzzle()`
- POST: promotes user to `"beginner"` + fires `trackTutorialCompleted`
- "Rather watch?" extracted to `TutorialWatchButton` island (renders after 3+ moves)

### Tutorial dialog (`islands/tutorial-dialog.tsx`)

- Copy rewrite: clearer language, mechanic-first
- Arrow icons on Previous/Next; "How it works" step label
- Welcome step: "Home" dismiss, "How it works" primary CTA

### Tracking (`lib/tracking.ts`)

- `trackTutorialCompleted` — sets `$set: { skill_level: "beginner" }` on PostHog profile
- `trackSkillLevelUp` — fires on intermediate/expert promotions, sets `$set: { skill_level }` on profile; includes `puzzle_difficulty`, `puzzle_min_moves`, `game_moves`, `skill_level`

### Migration (`routes/api/migrate-skill-level.ts`)

`GET /api/migrate-skill-level?secret=<MIGRATE_SECRET>` — assesses each user's skill level from their solution history using the same promotion rules, skips users already with `skillLevel`.

### Minor

- `solution-dialog.tsx`: copy tweaks ("Save", "Play again"), `autocomplete="username"`, removed "Close" button
- `celebration-dialog.tsx`: "Start over" → "Play again"
- `puzzle-card.tsx`, `[slug]/index.tsx`, `solutions/`, `preview/`, `share.ts`: `puzzle.number` guarded (undefined-safe)
- `routes/_app.tsx`: `"daily"` removed from OG image exclusion list
- `routes/puzzles/index.tsx`: hardcoded `"tutorial"` exclusion removed (loader filter handles it)

## Files

- **modified** `game/types.ts` — `Onboarding` → `SkillLevel`, `Puzzle.onboarding` → `onboardingLevel?: number`
- **modified** `db/types.ts` — `User.onboarding` → `skillLevel: SkillLevel | null`
- **modified** `middleware/user.ts` — new user defaults to `skillLevel: null`
- **modified** `game/loader.ts` — `onboardingLevel` filtering, `getTutorialPuzzle()`, `getOnboardingPuzzle({ excludeSlugs })`
- **modified** `lib/manifest.ts` — `onboardingLevel` field in manifest
- **modified** `lib/tracking.ts` — `trackTutorialCompleted` (profile set), `trackSkillLevelUp`
- **modified** `routes/index.tsx` — skill-level-based home page branching
- **modified** `routes/puzzles/[slug]/index.tsx` — skill promotion logic
- **modified** `routes/puzzles/tutorial/index.tsx` — `getTutorialPuzzle()`, beginner promotion, `TutorialWatchButton`
- **modified** `routes/puzzles/preview/index.tsx` — `skillLevel` prop on `ControlsPanel`
- **modified** `routes/puzzles/index.tsx` — removed hardcoded tutorial exclusion
- **modified** `routes/_app.tsx` — OG exclusion list
- **modified** `routes/api/migrate-user.ts` — removed `Onboarding` import
- **modified** `routes/api/e2e/users/index.ts` — `skillLevel` default
- **modified** `islands/controls-panel.tsx` — `onboarding` → `skillLevel`, hint logic updated
- **modified** `islands/tutorial-dialog.tsx` — copy + navigation icons
- **modified** `islands/solution-dialog.tsx` — copy + autocomplete
- **modified** `islands/celebration-dialog.tsx` — copy
- **modified** `components/puzzle-card.tsx` — null-safe number
- **added** `islands/tutorial-watch-button.tsx` — "Rather watch?" island
- **added** `static/puzzles/lars.md` — onboardingLevel 2, starter puzzle
- **added** `static/puzzles/lone.md` — onboardingLevel 3, quick puzzle
- **added** `routes/api/migrate-skill-level.ts` — skill level migration from solution history

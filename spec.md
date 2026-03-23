# Spec: Streak counter and personal stats

## Goal

Add streak counter and personal stats to Skub. Compute streak on the fly from
existing data — no new KV writes initially, revisit if performance degrades.

## Streak algorithm

Export `getAvailableEntries` from `game/loader.ts` (currently a private
function).

New file `game/streak.ts`:

- `getUserStats(userId: string)` — returns
  `{ currentStreak, bestStreak, totalSolves, optimalSolves }`
- Streak logic:
  1. Fetch all available `PuzzleManifestEntry[]` sorted ascending by `number`
  2. Fetch `listUserSolutions(userId, { limit: 500 })` and build a `Set<string>`
     of solved slugs
  3. **Current streak**: walk entries in reverse (descending by `number`); count
     consecutive hits, stop at first gap
  4. **Best streak**: walk the full history in ascending order; track running
     length and record the maximum
- `optimalSolves`: cross-reference solutions with manifest entries —
  count solutions where `moves.length === entry.minMoves`

## Surfaces

### 1. Celebration dialog (`islands/celebration-dialog.tsx`)

Streak line below the move-count heading, e.g. "5-day streak". Only render
when `currentStreak > 1`. Requires passing `userStats` as a prop to the dialog
(fetched server-side in the puzzle page handler).

### 2. Front page (`routes/index.tsx`)

Compact stats display near the puzzle list or header. Exact placement needs
iteration. Fetch `getUserStats` in the GET handler and include in `PageData`.

### 3. Controls panel (`islands/controls-panel.tsx`)

A "Stats" icon button linking to `/me` — the entry point to the personal stats
page. No KV call here; controls panel is an island.

### 4. Profile page (`routes/profile.tsx`)

New stats section below the existing name/theme settings:
- Current streak + best streak
- Total solves + optimal solves
- Optimal rate (percentage)

## Data fetching

- `getUserStats` is server-side only (reads KV + manifest)
- Fetch in page handlers where needed; pass as typed `PageData`
- Do NOT fetch in islands — no client-side KV access
- Where `userId` is already available in `ctx.state.userId`, no extra auth is
  needed

## Files affected

| Surface | Files |
|---------|-------|
| Core logic | `game/streak.ts` (new), `game/loader.ts` (export `getAvailableEntries`) |
| Celebration dialog | `islands/celebration-dialog.tsx`, `routes/puzzles/[slug]/index.tsx` |
| Front page | `routes/index.tsx` |
| Controls panel | `islands/controls-panel.tsx` (link to `/profile` only) |
| Profile page | `routes/profile.tsx` (add stats section) |

## Out of scope

- Storing streak in KV (revisit if compute is slow)
- Per-puzzle personal history view
- Social / comparative streak features
- Streak notifications or reminders

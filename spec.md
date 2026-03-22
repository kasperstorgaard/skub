# Restructure routes into subdirectories

## Context

Several route files need to move into subdirectories so that co-located files
(e.g. `_e2e/` test folders) can live next to them. Fresh ignores `_`-prefixed
and `()`-prefixed directories for routing, so the moves are invisible to users.

## Changes

| Before | After | Reason |
|---|---|---|
| `routes/contribute.tsx` | `routes/contribute/index.tsx` | room for `_e2e/` |
| `routes/profile.tsx` | `routes/profile/index.tsx` | room for `_e2e/` |
| `routes/puzzles/new.tsx` | `routes/puzzles/new/index.tsx` | consistency |
| `routes/puzzles/tutorial.tsx` | `routes/puzzles/tutorial/index.tsx` | room for `_e2e/` |
| `routes/puzzles/[slug]/clone.tsx` | `routes/puzzles/[slug]/(actions)/clone.ts` | group action routes |
| `routes/puzzles/[slug]/hint.tsx` | `routes/puzzles/[slug]/(actions)/hint.ts` | group action routes |
| `routes/puzzles/[slug]/solve.tsx` | `routes/puzzles/[slug]/(actions)/solve.ts` | group action routes |
| `routes/puzzles/[slug]/og-image.tsx` | `routes/puzzles/[slug]/og-image/index.tsx` | consistency |
| `routes/puzzles/[slug]/solutions/[solutionId].tsx` | `routes/puzzles/[slug]/solutions/[solutionId]/index.tsx` | room for `_e2e/` |
| `routes/puzzles/daily.tsx` | *(deleted)* | redirect folded into puzzles index |

All moves are pure renames — no content changes.

## Verification

- `deno task dev` — all routes resolve as before
- `deno fmt --check && deno lint && deno test -A` — clean

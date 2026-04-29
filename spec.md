# Chain games: `/puzzles/random` redirect + dialog buttons

## Problem

After solving a puzzle, players have to navigate back home (or to the archive)
to find the next thing to play. The flow is friction for engaged players who
just want to keep going. The home page already picks a "recommended" puzzle
for them — that same logic should be reachable from inside the post-solve
dialogs.

## Approach

Two pieces:

1. **`/puzzles/random` redirect route** — a server-side handler that picks the
   recommended puzzle for the user and 303s to `/puzzles/<slug>`. Works
   without JavaScript (it's a plain link target). Falls back to `/` when
   nothing can be recommended (new user with no skill level, or every puzzle
   perfected and "loke" can't be loaded).
2. **`pickRecommendedPuzzle(user, solutions)`** in a new
   `game/recommendation.ts` — extracts the home-page picker so both the home
   handler and the redirect route share one source of truth. Logic:
   - new user (`skillLevel === null`) → tutorial puzzle (filling the gap
     where the previous home logic returned nothing for new users)
   - beginner → onboarding puzzle, falling through to random when exhausted
   - everything perfected → "loke" (endgame puzzle)
   - otherwise → random non-optimal puzzle of appropriate difficulty,
     today's daily always excluded

The home handler is refactored to call `pickRecommendedPuzzle` instead of
inlining the decision tree. The home UI gates the new onboarding/recommended
cards behind `skillLevel !== null` so the existing "Learn the basics" CTA
remains the sole signal for brand-new players — the tutorial recommendation
is consumed by the `/puzzles/random` redirect, not the home cards.

Dialog buttons added in `SolutionDialog` and `CelebrationDialog` linking to
`/puzzles/random`. Plain `<a>` tags, no client-side state, no fetch — the
navigation does all the work.

In `CelebrationDialog` the **share** CTA is removed and its slot is taken
over by the new "Another puzzle" primary action. Share usage is effectively
zero today, and the chaining CTA earns the prime real-estate while the game
still builds critical mass through word of mouth. Share can come back later
once organic loops are stronger; the underlying `getShareText` helper stays
available.

## Non-goals

- A general "next puzzle" API endpoint returning JSON. Navigation-shaped is
  enough for the chaining UX; an API-shape would invite client-side state
  juggling that this feature doesn't need.
- Surfacing "another puzzle" on the home page or archive list. The button
  only appears in post-solve dialogs (the moment chaining matters).
- Changing the home page's tagline / `bestMoves` wiring for the picked puzzle —
  the refactor preserves existing behaviour byte-for-byte.
- Per-call exclusion (e.g. "skip the puzzle I just solved"). Optimal solves
  are already filtered out of the random pool; non-optimal repeats are rare
  enough not to warrant a `?exclude=` param's complexity.
- Celebration transition / animation buildup before the dialog opens
  (separate follow-up).
- Skipping name submission for anonymous players who click "Another puzzle"
  from `SolutionDialog` — that's the scoreboard-opt-out feature, deferred.
  The link bypasses Save as a side effect; acceptable for now.

# Extract preview puzzle into its own route

## Problem

`routes/puzzles/[slug]/index.tsx` contains two separate concerns — serving a regular
puzzle and serving a draft preview. The preview case is guarded by `slug === "preview"`
checks in both the GET and POST handlers, and the page component uses `isPreview` to
toggle behaviour. This leaks builder-only logic into the puzzle player route and makes
the `[slug]` handler harder to read.

## Solution

Move the preview concern into a dedicated static route at
`routes/puzzles/preview/index.tsx`. Fresh resolves static segments before dynamic ones,
so `/puzzles/preview` will be handled by the new file without any changes to routing
configuration.

The new route:
- GET: loads the user's puzzle draft via `getUserPuzzleDraft`, sets `slug = "preview"`
  and `number = 0` on the result, and renders the board page with no solution submission.
  Returns 500 if no draft exists.
- POST: returns 500 immediately ("Preview puzzle solutions cannot be submitted").

The page component is replicated (not abstracted) because the preview page renders a
proper subset of the full puzzle page — same visual structure, same islands — and
sharing a component would couple the two routes for no real gain at this codebase size.

`routes/puzzles/[slug]/index.tsx` is cleaned up: both `slug === "preview"` guards are
removed. `isPreview` is removed from `SolutionDialog` entirely (the preview route no
longer renders it).

## Behaviour changes

None visible to users. `/puzzles/preview` behaviour is identical — Fresh resolves static
segments before dynamic ones, so the new route takes over transparently.

## Files

- **new** `routes/puzzles/preview/index.tsx` — preview-only handler + page component (no SolutionDialog, no CelebrationDialog, no AutoPostSolution)
- **modified** `routes/puzzles/[slug]/index.tsx` — remove `preview` special cases
- **modified** `islands/solution-dialog.tsx` — remove `isPreview` prop entirely

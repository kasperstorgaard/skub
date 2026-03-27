# Extract preview route + simplify puzzle route

## Problem

`routes/puzzles/[slug]/index.tsx` had two separate concerns mixed in:

1. **Preview logic** — `slug === "preview"` guards in GET and POST, `isPreview` flags
   threaded through islands. Builder-only logic leaking into the player route.

2. **Overcomplicated GET handler** — three branching cases including a named-user
   fast path that duplicated save/track logic from POST, and a stats fetch for the
   celebrate dialog that was redundant once the island fetches fresh stats itself.

## Solution

### 1. Dedicated preview route

Move preview into `routes/puzzles/preview/index.tsx`. Fresh resolves static segments
before dynamic ones, so no routing config changes needed.

- GET: loads draft via `getUserPuzzleDraft`, renders board with no solution submission
- No POST handler — Fresh returns 405 naturally

The page component is replicated (not abstracted) — preview is a proper subset of the
full puzzle page, and sharing would couple the routes for no gain.

### 2. Unified no-JS solve path via SolutionDialog

The GET handler previously had two no-JS paths: anonymous users went to SolutionDialog,
named users saved directly and jumped to celebrate. This duplicated save/track logic
from POST and made the two paths diverge conceptually.

Now GET always redirects to `?dialog=solution` on a valid solve — regardless of whether
the user has a name. SolutionDialog handles both cases: anonymous users pick a name,
named users see pre-filled name and confirm. All saving goes through POST.

JS named users are unaffected — `AutoPostSolution` posts directly and bypasses the
dialog entirely.

### 3. Removed celebrate stats fetch from GET

GET was fetching `puzzleStats` and `userStats` when `dialog=celebrate` was in the URL.
This is now redundant: no-JS users go to the solutions page (not celebrate), and JS
users get fresh stats via the island fetch. The fetch is removed; GET always returns
`defaultPuzzleStats` and `userStats: null`.

## Behaviour changes

- No-JS named users now see SolutionDialog (pre-filled name) instead of being saved
  silently and jumping straight to celebrate. One extra click to confirm.
- `/puzzles/preview` behaviour is identical externally.

## Files

- **new** `routes/puzzles/preview/index.tsx` — preview-only handler + page component
- **modified** `routes/puzzles/[slug]/index.tsx` — remove preview guards, simplify GET, add `getSolveRedirectUrl` helper
- **modified** `islands/solution-dialog.tsx` — remove `isPreview`, open on `dialog=solution`, conditional copy for named users
- **modified** `CLAUDE.md` — note that function argument ordering is exempt for side-effect-only functions

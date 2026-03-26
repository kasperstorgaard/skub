# Fresh stats in CelebrationDialog

## Problem

`CelebrationDialog` receives `userStats` and `puzzleStats` as server-rendered
props fetched at initial page load — before the user has solved the puzzle. On
the JS path, `AutoPostSolution` posts the solution client-side and updates
`href` via a signal without reloading the page, so neither stat is ever
refreshed. This causes stale or wrong celebration messages (wrong streak count,
missed milestones, incorrect "first solver" detection).

## Solution

Progressive enhancement: the server-side (no-JS) path already reloads the
page, so it just needs the GET handler to fetch stats at the right time. The
JS path gets a client-side fetch inside `CelebrationDialog`.

### 1. Headline is always local

The headline no longer depends on server data:

```ts
const isOptimal = moveCount === puzzle.minMoves;
const headline = isOptimal ? `Perfect — ${moveCount} moves` : `Solved — ${moveCount} moves`;
```

`"First to solve!"` becomes a body-only message — the headline stays as
`Solved — X moves`. This means the headline can always render immediately from
URL state and the puzzle prop, with no loading state needed.

### 2. GET handler — fetch stats only when needed

Guard both stat fetches behind `dialog=celebrate`:

```ts
const isDialog = ctx.url.searchParams.get("dialog") === "celebrate";
const [puzzleStats, userStats] = isDialog
  ? await Promise.all([getPuzzleStats(slug), savedName ? getUserStats(ctx.state.userId) : null])
  : [defaultPuzzleStats, null];
```

- No-JS path: page reloads with `?dialog=celebrate` → stats are fresh
- JS path (initial load): `dialog` is absent → both fetches skipped, saving DB calls

### 3. `/api/celebrate-stats` endpoint

Single GET endpoint returning `{ puzzleStats: PuzzleStats, userStats: UserStats | null }`.
One round-trip, one loading state. Returns `null` for `userStats` when
unauthenticated.

### 4. `CelebrationDialog` — island fetch on celebrate

When `dialog=celebrate` appears in `href`, fetch `/api/celebrate-stats` and
update a local signal that shadows the props:

```ts
type LiveStats = { puzzleStats: PuzzleStats; userStats: UserStats | null } | null;
const liveStats = useSignal<LiveStats>(null);

useEffect(() => {
  if (dialog !== "celebrate") return;
  fetch("/api/celebrate-stats")
    .then((r) => r.json())
    .then((data) => { liveStats.value = data; });
}, [dialog]);
```

Use `liveStats.value?.puzzleStats ?? stats` and `liveStats.value?.userStats ?? userStats`
when calling `getCelebration`.

### 5. Skeleton while loading

Headline renders immediately (always local). The body line shows a skeleton
placeholder until `liveStats` resolves.

## Fallback behaviour

| Path | Stats source | Accuracy |
|---|---|---|
| No-JS | GET handler props (behind `dialog=celebrate` guard) | Fresh |
| JS, fetch succeeds | Island fetch | Fresh |
| JS, fetch fails | Props (stale) | Same as today |

## Files

- `routes/puzzles/[slug]/index.tsx` — guard both stat fetches behind `isDialog`
- `routes/api/celebrate-stats.ts` — new combined endpoint
- `islands/celebration-dialog.tsx` — simplified headline, local signal, island fetch, body skeleton

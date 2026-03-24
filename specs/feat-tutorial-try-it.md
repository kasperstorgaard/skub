# Tutorial: hands-on first, replay as fallback

## Goal

Change the tutorial from "watch a replay" to "try it yourself" as the default path. The replay becomes a fallback for users who get stuck, via a persistent "Show me" button near the board.

## Flow

```
Welcome → The pieces → "Try it!" → solve mode (dialog closes)
                                      ├→ user solves → "You found a solution!" → "I'm ready" → /
                                      └→ "Show me" fallback → replay → "Finding a solution" → "I'm ready" → /
```

One primary action per step. No choice paralysis.

## Implementation

### URL-driven state

All state is encoded in URL search params — no `useEffect` syncing:

- `?dialog=tutorial` — controls dialog visibility (follows existing dialog convention)
- `?tutorial_step=welcome|pieces|replay|solved` — current tutorial step
- `?mode=solve|replay` — board mode (omitted = readonly default)
- `?replay_speed=N` — replay animation speed

### Tutorial route (`routes/puzzles/tutorial/index.tsx`)

- No mode/dialog/step params: redirects to `?dialog=tutorial&tutorial_step=welcome`
- Valid solution moves (no dialog, not replay): redirects to `?dialog=tutorial&tutorial_step=solved`
- `showMeUrl` built server-side with `mode=replay`, encoded solution moves, `dialog=tutorial`, `tutorial_step=replay`, `replay_speed=1`
- POST handler validates solution, redirects to completion

### Tutorial dialog (`islands/tutorial-dialog.tsx`)

Dialog derives its own `open` state from `?dialog=tutorial` via the reactive `href` signal.

**Welcome** — intro text, "Dismiss" (POST) and "Next" actions

**The pieces** — explains puck, blocker, destination. "Try it!" closes dialog, enters solve mode (`?mode=solve`)

**Finding a solution** (replay path) — shown after replay animation completes. Body:
> That's one way to solve it. [Show again]
> Every puzzle has many solutions, each ranked by number of moves. A new puzzle drops every day.

**You found a solution!** (solve path) — shown after user solves by making moves. Body:
> Every puzzle has many solutions, each ranked by number of moves. Today's puzzle is waiting.

Both end steps use "I'm ready" link to `/`.

### "Show me" fallback

- Visible during solve mode (`?mode=solve`), below the board
- Links to `showMeUrl` (enters replay flow)
- Visually secondary — not a game control, a tutorial escape hatch

### What stays the same

- Onboarding state transitions (`new` → `started` on first visit)
- Solution is **not** saved to KV — tutorial solves are ephemeral
- POST handler for dismiss

## Files modified

- `routes/puzzles/tutorial/index.tsx` — route logic, URL-driven state, showMeUrl
- `islands/tutorial-dialog.tsx` — named steps, "Try it!" action, solve/replay end steps, "I'm ready" CTA
- `routes/puzzles/tutorial/_e2e/tutorial-page.ts` — page object updated for new flow
- `routes/puzzles/tutorial/_e2e/tutorial_test.ts` — primary test solves by clicking, secondary tests replay path
- `e2e/new-user-flow_test.ts` — golden path uses solve-by-clicking

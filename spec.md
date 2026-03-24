# Tutorial: hands-on first, replay as fallback

## Goal

Change the tutorial from "watch a replay" to "try it yourself" as the default path. The replay becomes a fallback for users who get stuck, via a persistent "Show me" button near the board.

## Current flow

```
Step 0 (Welcome) → Step 1 (The pieces) → "Show me!" → Step 2 (replay → "Finding a solution")
                                                                └→ Let's go! (POST → /)
```

## Proposed flow

```
Step 0 (Welcome) → Step 1 (The pieces) → "Try it!" → solve mode (dialog closes)
                                                        ├→ user solves → Step 3 ("You found a solution!")
                                                        │                  └→ Let's go! (POST → /)
                                                        └→ "Show me" fallback → Step 2 (replay, unchanged)
```

One primary action per step. No choice paralysis.

## Implementation

### Tutorial route (`routes/puzzles/tutorial/index.tsx`)

- `?mode=solve` **without** valid solution moves: skip the moves redirect, render board in `solve` mode, no dialog open, show "Show me" fallback button
- `?mode=solve` **with** valid solution moves: render with `step=3` (completion dialog)
- No `?mode=` param: existing replay path, untouched

### Tutorial dialog (`islands/tutorial-dialog.tsx`)

**Step 1** — change primary action:
- "Try it!" replaces "Show me!" → navigates to `?mode=solve` (clears moves, closes dialog)

**Step 2** (replay) — unchanged, reachable via the "Show me" fallback button

**Step 3** (new) — completion after hands-on solve:
- Heading: "You found a solution!" (or similar — slightly different from step 2's "Finding a solution")
- Body acknowledges the solve, mentions that many solutions exist ranked by move count, references the control panel
- "Let's go!" POST button (same dismiss behaviour as step 2)

### "Show me" fallback button

- Persistent link visible during solve mode (`?mode=solve`)
- Position: below the board on mobile, beside it on desktop
- Links to `?step=2&replay_speed=1` (enters the existing replay flow)
- Visually secondary — not a game control, clearly a tutorial escape hatch

### Board mode

Uses existing board mode vocabulary, driven by `?mode=` URL param:

- `?mode=solve` without solved state → board mode `"solve"` (interactive)
- `?mode=solve` with solved state → board mode `"readonly"` (frozen, dialog on top)
- No `?mode=` param → existing behaviour (`"readonly"` / `"replay"`)

### What stays the same

- Step 0 (Welcome) — unchanged
- Step 2 (replay path) — unchanged
- Onboarding state transitions — unchanged (`new` → `started` on first visit)
- Solution is **not** saved to KV — tutorial solves are ephemeral
- POST handler for dismiss — unchanged

## Files to modify

- `routes/puzzles/tutorial/index.tsx` — route logic for `mode=solve`, "Show me" fallback placement
- `islands/tutorial-dialog.tsx` — step 1 button text + new step 3

## Open questions

- Exact copy for step 3 body text
- "Show me" button styling/placement details

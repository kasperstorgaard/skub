# Flash mode

## Problem

Flash is for two moments: "this one is annoying me a bit" and "I'm still new at
this". Today the single hint is all those players have. A head start lets them
finish and enjoy the rest of the puzzle, on the understanding that the solve
stays off the leaderboard.

## Approach

**Flash** gives a head start: the first moves of an optimal solution are
already played.

| Shortest solution | Head start |
| ----------------- | ---------- |
| 10+               | 3 moves    |
| 8–9               | 2 moves    |
| 5–7               | 1 move     |
| under 5           | no Flash   |

### The switch

On the puzzle page, the difficulty badge becomes a switch, built like the
editor's solution badge. A lightning-bolt cell replaces the difficulty label,
with the move count beside it. When Flash is on, the whole badge takes a brand →
link pearl gradient. Puzzles under 5 moves keep the plain badge, and the badge
on other pages (solutions, preview, candidates) is unchanged.

### Accepting

The switch links to `?dialog=flash`, a dialog that explains Flash. Its tone
suits those two moments: friendly, never framed as giving up. It covers the head
start and the leaderboard cost, not the 24-hour lock: a player in a hurry who
plays the same puzzle again is a weird combo, and Flash doesn't cater to it. It
shows on every turn-on. Accepting is a form POST to the new Flash action. The
action solves the clean board (the same worker the hint uses), keeps the
head-start moves in a `flash` cookie scoped to `/puzzles/<slug>` for 24 hours,
and 303s back to the puzzle. "Not now" just closes the dialog.

The cookie holds the moves themselves, not a count, so nothing downstream cares
where they came from. A later change could let a puzzle author its own Flash
start.

### A shorter puzzle

With Flash on, the puzzle page and the hint play a genuinely shorter puzzle under
the same name: the board after the head start, with the head start taken off the
minimum (`withHeadStart`). Moves in the URL count from there. The counter starts
at 00, undo and "Start over" stop at the Flash start, and the hint, the board
and the celebration work unchanged. The head start comes from an optimal
solution, so the shorter puzzle's minimum is exact.

Only the puzzle page and the hint swap the puzzle. The `[slug]` middleware
doesn't, because the cookie also reaches the solutions page, og-image, rate and
clone, which should show the real puzzle.

- The switch stays on and can't be turned off until the cookie expires.
- The hint still works on top. Players who already use hints keep them, and
  some players will want both. What separates them is the leaderboard: a hint
  keeps you on it, Flash doesn't.

### Solving with Flash

- Everyone gets the normal celebration, minus the name prompt, including on a
  player's first solve. The headline (Perfect / Great / Solved) compares
  against the shorter puzzle. The stats line is replaced by "Flash solves stay
  off the leaderboard", since every stats variant compares against it.
- Without JS, the solve dialog shows the same line, and its "One more" button
  posts the solve and goes to the recommended puzzle.
- The POST puts the head start back in front of the moves, so the solve kept is
  the whole puzzle. It's saved under the player's own keys only, marked
  `flash`. Progress is rebuilt from those keys, so it counts toward the streak
  and reveals the move count. The public keys, stats and canonical groups never
  see it. Per-user dedup tells Flash and normal solves apart, so the same route
  solved normally after the 24 hours still counts.
- The POST handler reads the cookie, so posting a Flash solve with a name still
  keeps it off the leaderboard.
- Flash solves don't assess skill level.

### Why not a separate puzzle

A Flash puzzle with its own slug would make the leaderboard split automatic,
but progress and streak are keyed by slug and puzzle number, so it would need
mapping back. It would also bring a leaderboard of its own (the open "+x flash"
question), and routes for a puzzle that isn't a file.

### Analytics

- `flash_enabled` when the player accepts (puzzle, head start size).
- `puzzle_solved` gets a `flash` property rather than a new event.

## Non-goals

- Stars and showing Flash on the leaderboard (TODO.md → Play).
- Authored Flash starts per puzzle. The cookie already allows for them.
- Storing optimal solutions in the manifest. Solving on accept is the same cost
  as a hint.
- Signing the cookie. Clearing cookies already escapes the hint limit, so the
  same holds here.
- Per-theme pearl styling. Themes that restyle `.difficulty-badge` may need a
  pass.

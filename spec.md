# Flash mode

## Problem

Flash is for two moments: "this one is annoying me a bit" and "I'm still new at
this". Today the single hint is all those players have. A Flash start lets them
finish and enjoy the rest of the puzzle, on the understanding that the solve
stays off the leaderboard.

## Approach

**Flash** starts the puzzle at its **Flash start**: the first moves of an
optimal solution, already played.

| Shortest solution | Flash start |
| ----------------- | ---------- |
| 10+               | 3 moves     |
| 8–9               | 2 moves     |
| 5–7               | 1 move      |
| under 5           | no Flash    |

### Where the Flash start comes from

It's stored with the puzzle, as a `flashStart` line in its frontmatter,
generated on promotion by solving the board (`generateFlashStart`). A one-off
script backfilled the puzzles shipped before Flash
(`scripts/backfill-flash-starts.ts`); it adds the line without reformatting, so
the boards are untouched. Ulf's start is chosen by hand: with 28 blockers it's
too slow per state to solve, and a crowded candidate could stall promotion the
same way. A tool for choosing Flash starts by hand is a TODO.md item; for now
it's a frontmatter edit.

A hand-chosen start can be any length. The shorter puzzle's minimum assumes it
lies on an optimal path.

Because it's stored, turning Flash on runs no solver, and the leaderboard rule
can't drift from what the player was shown.

### The switch

On the puzzle page, the difficulty badge becomes a switch, built like the
editor's solution badge. A lightning-bolt cell replaces the difficulty label,
with the move count beside it. When Flash is on, the whole badge takes a brand →
link pearl gradient. Puzzles under 5 moves keep the plain badge, and the badge
on other pages (solutions, preview, candidates) is unchanged.

### Accepting

The switch links to `?dialog=flash`, a dialog that explains Flash. Its tone
suits those two moments: friendly, never framed as giving up. It covers the
Flash start and the leaderboard cost, not the 24-hour lock: a player in a hurry who
plays the same puzzle again is a weird combo, and Flash doesn't cater to it. It
shows on every turn-on. Accepting is a form POST to the new Flash action, which
keeps the puzzle's Flash start in a `flash` cookie scoped to `/puzzles/<slug>`
for 24 hours and 303s back to the puzzle. "Not now" just closes the dialog.

The cookie holds the moves themselves, so a Flash start that changes later (by
hand, say) doesn't affect a player already playing it.

### A shorter puzzle

With Flash on, the puzzle page and the hint play a genuinely shorter puzzle under
the same name: the board after the Flash start, with the Flash start taken off the
minimum (`withFlashStart`). Moves in the URL count from there. The counter starts
at 00, undo and "Start over" stop at the Flash start, and the hint, the board
and the celebration work unchanged. The Flash start comes from an optimal
solution, so the shorter puzzle's minimum is exact.

Only the puzzle page and the hint swap the puzzle. The `[slug]` middleware
doesn't, because the cookie also reaches the solutions page, og-image, rate and
clone, which should show the real puzzle.

- The switch stays on and can't be turned off until the cookie expires.
- The hint still works on top. Players who already use hints keep them, and
  some players will want both. What separates them is the leaderboard: a hint
  keeps you on it, Flash doesn't.

### Solving with Flash

A Flash solve goes through the normal solve flow: new players are asked for a
name, named players get the auto-post and the celebration. Only where it's
stored differs.

- The celebration's headline (Perfect / Great / Solved) compares against the
  shorter puzzle. In place of the stats line, which compares against the
  leaderboard, it says "Started N moves in with Flash".
- A Flash solution is a regular solution with one bool on it, `flash`, and the
  Flash start coded into its moves: the POST puts the start back in front, so
  the solve kept is the whole puzzle. It's stored under the same keys as any
  solve, name included, so Flash solves are tracked now for a Flash leaderboard
  later (TODO.md → Play). It skips the aggregates (stats and canonical groups),
  and the leaderboard is built from those, so it never shows there.
- Progress is rebuilt from the player's own keys, so a Flash solve counts toward
  the streak and reveals the move count. Per-user dedup tells Flash and normal
  solves apart, so the same route solved normally after the 24 hours still
  counts.
- The POST handler reads the cookie, so posting a Flash solve directly still
  keeps it off the leaderboard.
- Flash solves don't assess skill level.

### Why not a separate puzzle

A Flash puzzle with its own slug would make the leaderboard split automatic,
but progress and streak are keyed by slug and puzzle number, so it would need
mapping back. It would also bring a leaderboard of its own (the open "+x flash"
question), and routes for a puzzle that isn't a file.

### Analytics

- `flash_enabled` when the player accepts (puzzle, Flash start length).
- `puzzle_solved` gets a `flash` property rather than a new event.

## Non-goals

- Stars, and a page for the Flash leaderboard (TODO.md → Play).
- Choosing Flash starts by hand (TODO.md → Play).
- Speedy boi, a setting that keeps Flash on for every puzzle. It builds on the
  stored Flash start and comes next.
- Signing the cookie. Clearing cookies already escapes the hint limit, so the
  same holds here.
- Per-theme pearl styling. Themes that restyle `.difficulty-badge` may need a
  pass.

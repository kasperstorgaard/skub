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
suits those two moments: friendly, never framed as giving up. It shows on every
turn-on, since each one locks that puzzle for a day. Accepting is a form POST to
the new Flash action. The action solves the clean board (the same worker the
hint uses), keeps the head-start moves in a `flash` cookie scoped to
`/puzzles/<slug>` for 24 hours, and 303s to the puzzle with only the head start
played. The board starts over from there; any moves already made are dropped.
"Not now" just closes the dialog.

The cookie holds the moves themselves, not a count, so nothing downstream cares
where they came from. A later change could let a puzzle author its own Flash
start.

### While on

- The head start is locked: in effect Flash is one, two or three hints played
  for you. Undo stops at it, and "Start over" goes back to it, not to a clean
  board. Server-side, any URL whose played moves don't begin with the head start
  redirects to it, which also covers reloads, return visits and no-JS.
- The switch stays on and can't be turned off until the cookie expires.
- The hint still works on top. Players who already use hints keep them, and
  some players will want both. What separates them is the leaderboard: a hint
  keeps you on it, Flash doesn't.

### Solving with Flash

- No name prompt, including on a player's first solve. Named players don't get
  the celebration. Instead, a short dialog states the move count and how many
  of those moves Flash played. Its "One more" button posts the solve and goes to
  the recommended puzzle. With JS, the solve is also auto-posted without a name.
- The solve is saved under the player's own keys only, marked `flash`. Progress
  is rebuilt from those keys, so it counts toward the streak and reveals the
  move count. The public keys, stats and canonical groups never see it, so it
  never shows on the leaderboard. Per-user dedup tells Flash and normal solves
  apart, so the same route solved normally after the 24 hours still counts.
- The POST handler reads the cookie, so posting a Flash solve with a name still
  keeps it off the leaderboard.
- Flash solves don't assess skill level.

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

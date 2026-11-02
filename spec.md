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

The difficulty badge on the puzzle page becomes a switch, built like the
editor's solution badge. A lightning-bolt cell takes the place of the difficulty
label, with the move count beside it. When Flash is on, the whole badge takes a
primary → secondary pearl gradient. Puzzles under 5 moves keep the plain badge.
The badge on other pages (solutions, preview, candidates) is unchanged.

### Accepting

The first time the switch is turned on, a dialog explains Flash. Its tone suits
those two moments: friendly, never framed as giving up. It covers a 1–3 move head
start, no name on the leaderboard for this puzzle, and the lock lasts 24 hours.
Accepting POSTs to a new puzzle action. It solves the clean board (the same
worker the hint uses), sets a `flash` cookie scoped to `/puzzles/<slug>` for 24
hours, and 303s to the puzzle with the head-start moves in the URL. The board
starts over from there, discarding any moves already made. Cancelling leaves
everything as it was.

Without JS, the switch is a submit button in a form, and the dialog is a
`?dialog=flash` page state, like the hint dialog.

### While on

- The switch stays on and can't be turned off until the cookie expires. Reloads
  and returning visits within 24 hours show Flash on, the head start already
  played.
- Undo, reset and the hint work as normal. The cookie gates the leaderboard, not
  the moves on the board.

### Solving with Flash

- The solve is recorded in progress, so it counts toward the streak and
  reveals the move count. The full move list, head start included, is what gets
  recorded.
- It is **not** saved to solutions, stats or canonical groups, so it never shows
  on the leaderboard.
- No name prompt, including on a player's first solve. Named players don't get
  the auto-post or the celebration either. A short Flash closing dialog takes
  their place: facts only, plus "One more".
- The POST handler reads the cookie, so a client can't save a Flash solve to the
  leaderboard by posting it anyway.

### Analytics

- `flash_enabled` when the player accepts (puzzle, head start size).
- `puzzle_solved` gets a `flash: true` property rather than a new event.

## Non-goals

- Stars and showing Flash on the leaderboard (TODO.md → Play).
- Storing optimal solutions in the manifest. Solving on accept is the same cost
  as a hint.
- Signing the cookie. Clearing cookies already escapes the hint limit, so the
  same holds here.

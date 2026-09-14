# Portal routes, and the notation that tells them apart

## The problem

A move is recorded as two positions: where a piece started, and where it came to
rest. That pair is what the URL carries, what a stored solution holds, and what
the solver emits — and on a board with portals it is not always enough to say
what happened.

Put a portal on a board edge and two different slides out of one cell can end on
the same square. With portals in the SW and NE corners, a piece on H8 slides west
along the bottom row, into the portal on A8, out at H1, and on west along the top
row to A1. The same piece slides north up the right-hand column, into H1, out at
A8, and on north to A1. Two routes, two directions, one destination — and one
pair of endpoints describing both.

Replaying such a move meant re-running all four directions and taking the first
whose endpoint matched. So a move made westward was drawn northward: the piece
set off up the wrong edge and surfaced at the wrong corner. It reached the right
square, which is why nothing downstream ever noticed.

It needs an edge to happen. Across every portal pair on the board there are 144
colliding direction-pairs when a portal sits on an edge, 52 of those on a corner,
and none at all when both portals are interior. No collision anywhere disagrees
about where the piece lands or whether it dropped or looped, so move counts,
difficulty, loop detection and stored solutions were never affected. Only the
picture was wrong.

## The approach

A move that teleports records the portal it went in by, written into the move
notation as `A8xA1` — the path as far as the portal, then `x`, then where the
piece came to rest. `H7H8-A8xA1` reads as "H7 to H8, then west into the portal on
A8 and on to A1".

The portal is enough on its own: going in by a given portal fixes which one it
comes out of, and the direction follows from the start and the entry. Recording
the exit as well would only repeat what the board already knows. Recording the
direction instead would be a character shorter but would put something that isn't
a square into a notation where every token is one.

Only a slide that teleports grows the suffix, so every URL and stored solution
that exists today encodes and replays byte-for-byte as it did. A move carrying no
portal falls back to the old first-match behaviour, which is also what an edited
board gets when the portal it recorded is no longer there.

Canonical move keys stay on the endpoints alone. They feed solution grouping and
the aggregates built on it, and folding the route into them would split existing
groups apart.

## Also in here

Two editor fixes that came out of the same session. The toolbar had wrapped onto
a second row on mobile ever since holes and portals added two tools to a
four-column grid; its columns flow now, so the row fits however many tools got
drawn. And the hint link no longer explains itself when a portal loop has locked
the board — it was already disabled, and the label now only claims a hint was
used when one actually was.

Plus a batch of new puzzles and the candidates behind them.

## Non-goals

- **The solver still emits plain pairs.** Hints and the solutions replay take
  whatever route direction order lands on, exactly as before. Same endpoints and
  same move count, possibly the other picture. `walkSlide` knows the direction,
  so it is a contained follow-up rather than a redesign.
- **No change to how moves are grouped, scored or stored.** The notation is
  additive; nothing already written needs migrating.

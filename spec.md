# Pointer gestures

Swipe and tap on the board without zingtouch.

## Problem

`client/touch.ts` loads zingtouch (6.6 KB gz, dynamic, touch devices only) to
read one swipe and forward taps. It is a general gesture library: the parts we
use are a few rules that can be stated and tested directly.

## Approach

A pure `readGesture()` in `client/touch.ts` takes the pointer trace (start,
moves, end, each with a timestamp, plus the swipe region's rect) and returns
the swipe (direction, velocity) and whether it was a tap. It reproduces
zingtouch 1.0.6's `Swipe` (with our `escapeVelocity: 0.25`, `maxRestTime: 100`)
and `Tap` (defaults) rules. `useSwipe` feeds it from `pointerdown` /
`pointermove` / `pointerup` on the same swipe region; the piece lookup, tap
forwarding and `calculateMoveSpeed` are unchanged.

## Preserved zingtouch behaviour

- Swipe needs ≥ 3 move events, and the finger lifts within 100 ms of the last
  one.
- Velocity and direction come from the final segment only: the last move and
  the latest earlier move with a different millisecond timestamp. Velocity is
  px/ms (distance rounded to 0.01 px) and must be ≥ 0.25. No minimum distance.
- Direction by angle, 90° quadrants; exact diagonals resolve up-right → up,
  down-right → right, up-left → left, down-left → down.
- A swipe only moves a piece when the gesture started within one cell of a
  piece's centre (nearest wins).
- Tap: lifted within 300 ms of the down, and no single move step > 10 px on
  either axis. The element under the lift point gets `.click()`.
- Swipe and tap are judged independently; a quick tiny flick can be both.
- The gesture is dropped if any point before the lift left the swipe region
  (strict bounds), or if a second finger touches down.
- Only on devices with touch (`ontouchstart`); the region has `touch-action:
  none`, so page scroll never starts on it. Keyboard input is untouched.
- Timestamps are `Date.now()` at handling time, as zingtouch did.

## Verify on device (preview URL)

- [ ] Swipe up, down, left, right on the puck and a blocker: piece slides
      that way, at a speed that feels the same as production.
- [ ] Short slow drag and a long slow drag: no move.
- [ ] Swipe starting just off the board edge near a piece: still moves it.
- [ ] Tap a piece: selects it (one selection, not toggled).
- [ ] Tap an empty cell / guide arrow: same as production.
- [ ] Scroll the page by dragging just outside the swipe region: scrolls; no
      piece moves.
- [ ] Two-finger touch or pinch on the board: nothing moves.
- [ ] Swipe, then an interrupting system gesture (notification shade, app
      switch) mid-swipe; next swipe works.

## Open questions

- Behaviour not reproduced on purpose: zingtouch ignores `touchcancel`, which
  can leave a stale input so the next touch counts as two fingers and is
  dropped. Pointer events reset on `pointercancel` instead.
- zingtouch also listened to mouse events on touch devices, so a tap could be
  forwarded twice (touch, then the browser's compatibility mouse events). The
  pointer version forwards once. Taps navigate links, so twice and once should
  look the same; confirm on device.
- Mouse on a touch-capable device: taps are forwarded, drags never move a piece
  (zingtouch only found a piece on `touchstart`). Kept as is.

## Non-goals

- Changing gesture thresholds or feel. Any tuning is a separate change.

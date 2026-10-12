# Pointer gestures, again

Re-lands #253 (zingtouch → pointer events) as it was tested on a phone.

## Problem

#253 was merged with one change made after the phone test: gesture times
came from the event's `timeStamp` instead of `Date.now()`. On mobile, swipes
and taps on the board then did nothing, and #255 reverted it. Both checks
compare the lift time with earlier event times, so the likely cause is
`pointerup` reporting its `timeStamp` on a different basis than
`pointerdown` / `pointermove`. Not confirmed on device.

## Approach

Revert the revert, with timestamps back to `Date.now()` at handling time, as
zingtouch did and as the phone test ran. Everything else is #253 unchanged;
see `specs/253-perf-pointer-gestures.md` (its line about `timeStamp`
describes what shipped and was reverted).

## Verify on device

Before merging, on the preview: swipe all four directions, tap a piece, an
empty cell and a guide arrow.

## Non-goals

- `e.timeStamp`. Revisit only if swipes feel uneven while the page is busy,
  with an on-device log of both clocks first.

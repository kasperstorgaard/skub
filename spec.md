# Tutorial UX copy + flow polish

## Problem

The tutorial and solution dialog copy was wordy and didn't read well. Button
labels were generic ("Dismiss", "Next") instead of describing what they do.
Headings buried the key idea.

## Solution

Tighten the copy in the tutorial dialog and solution dialog. Replace generic
button labels with action-oriented ones, and add directional arrow icons to
Previous/Next so navigation reads at a glance.

### Tutorial dialog (`islands/tutorial-dialog.tsx`)

**Welcome step**
- Body: shortened to "A sliding puzzle game inspired by the boardgame Ricochet Robots."
- "Dismiss" → "Home"
- "Next" → "How it works" + right-arrow icon

**Pieces step**
- Heading: "The pieces" → "How it works"
- Body: rewritten to emphasise the goal — puck must stop **exactly** on the target
- Previous button gets a left-arrow icon

**Replay step**
- Heading: "Finding a solution" → "That's one way to solve it"
- Body: mentions that both the daily and a starter puzzle are prepped for the user
- Previous button gets a left-arrow icon

### Solution dialog (`islands/solution-dialog.tsx`)

- Body copy: "Claim your solve to see how others did it." → "Get your solve on the board." (and the unnamed variant matches)
- Removed the redundant "Close" button — "Try again" already covers the dismiss case

## Follow-up

- **e2e selector is stale**: `routes/puzzles/tutorial/_e2e/tutorial-page.ts:29`
  still matches `/finding a solution/i`. Update to `/that's one way to solve it/i`
  before the e2e suite runs.

## Files

- **modified** `islands/tutorial-dialog.tsx` — copy + arrow icons across all three steps
- **modified** `islands/solution-dialog.tsx` — copy tweak, removed Close button

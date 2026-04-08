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
- "I'm ready" → "I'm ready!"

**Solved step**
- Body: same "daily and starter puzzle prepped" line as the replay step
- Previous button gets a left-arrow icon
- "I'm ready" → "I'm ready!"

### Solution dialog (`islands/solution-dialog.tsx`)

- Body copy: "Claim your solve to see how others did it." → "Get your solve on the board." (and the unnamed variant matches)
- Removed the redundant "Close" button — "Try again" already covers the dismiss case

## E2e updates

`routes/puzzles/tutorial/_e2e/tutorial-page.ts` matchers updated to track copy:
- `piecesHeading` → `/how it works/i`
- `solutionHeading` → `/that's one way to solve it/i`
- `clickNext()` → `/how it works/i`

`/i'm ready/i` substring-matches "I'm ready!" so no change needed there.

## Files

- **modified** `islands/tutorial-dialog.tsx` — copy + arrow icons across all four steps
- **modified** `islands/solution-dialog.tsx` — copy tweak, removed Close button
- **modified** `routes/puzzles/tutorial/_e2e/tutorial-page.ts` — selectors track new copy

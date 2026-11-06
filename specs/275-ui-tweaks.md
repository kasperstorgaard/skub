# UI tweaks

## Problem

The main look read techy and retro — a sharp techno font, a control panel that
was half game controls and half footer, and badges that talked about
difficulty more than about the puzzle you're playing. Skub is a calm thinking
puzzle: modern and a little refined, friendly rather than editorial.

## Approach

### Type

- **Outfit** replaces Chakra Petch: geometric, round, one variable file
  (weights 100–900, ~32 KB latin, about what the three static Chakra files
  cost). Retro themes keep their own fonts.
- Type roles (`type-title-lg`, `type-title`, `type-meta`, `type-tag`, …) pair
  size, weight and leading. Leads and titles sit tight; the line-height is the
  spacing.
- Puzzle titles stack the number over the name: on cards the number joins the
  lead ("Daily puzzle #309", then the name); on pages (`PuzzleName`) it's a
  light, muted line above the name. Unnumbered puzzles put what they are
  there instead: "Learn the basics" on the tutorial, "Starter puzzle",
  "Quick puzzle", "Preview".
- The home wordmark ripples once on load: each letter swells 300 → 600 and
  settles at 500, staggered left to right.

### Surface

- **Pearl** (brand → link with a soft sheen) is a design token. Buttons wear it
  as a ring: faint at rest, full on hover; hover fills at half strength. Every
  button is the same, no primary variant. Disabled buttons get a flat ring, not a faded pearl.
  The Flash bolt fills with it when Flash is on.
- **Grain**: a fine noise texture over the page backdrop, blended (overlay) so
  it moves around each theme's surface colour instead of lifting it toward
  grey.
- **`--color-panel`**: the sidebar's own colour. It defaults to `surface-2`;
  skub, dracula and acid darken their surface 30% toward black instead.
- **`--color-raised-1` / `-2`**: fills that sit on the page, like the score
  badge. Derived from the page, mixed 8% and 14% toward its text, so they rise
  off it in every theme; `surface-2` sank into the page on Dracula.
- Retro and high-contrast themes keep their own looks for all of the above.

### Playing a puzzle

- **Toolbar beside the board**, sharing the editor's toolbar layout: undo,
  redo, hint and start over with their keys, plus a note that arrow keys and
  TAB move. A column to the board's right on desktop, a row under it on
  mobile. Nudges move under the board.
- **Score badge** replaces the difficulty badge and the move counter: moves
  played over the shortest solution ("3/10", or "3/?" until solved), behind the
  Flash switch when the puzzle has a Flash start.
- A Flash solve stays off the solves list: afterwards the page returns to the
  solved board, "See solves" is hidden, and it never promotes a player's skill
  level past beginner.
- The score's shortest half ("/10", "/?") is faded: your count leads.

### Building a puzzle

- The editor's toolbar holds the board actions too: rotate, mirror both ways
  and clear, then Play, set apart, which opens the preview. It shows one set
  at a time: the cell tools (with their keys) while a cell is selected, the
  board actions otherwise.
- On mobile the toolbar is a full-bleed carousel of two snapping slides,
  board actions and cell tools, flicked or paged by an arrow at the edge that
  points to the other slide. Selecting a cell scrolls to the tools, which are
  disabled until a cell is selected. Desktop swaps in place with a close
  button; whether it slides too is open.
- The corner wall button is gone; C still toggles it.
- Sending a puzzle in moves to the nudge spot under the toolbar: empty until
  the board can be sent, then "Happy with it?" over "Send it in".
  The dialog says "sent", not "submitted". The sidebar keeps only the local
  Review and drops its builder link.
- Cell glyphs share one size; the solution badge grows to the score badge's
  size on mobile.

### Titles

Every page title's lead sits above it, never below, and it's one thing: the
puzzle's number on the puzzle page, or what the page shows in its place
("Solves", "Solved by Kasper", "Build a puzzle", "Candidate · generated", the
year on Puzzles), in sentence case like the cards' leads. Puzzle titles (editor, tutorial, candidates included) all use
the page-title type, and badges line up with the name's bottom.

The archive is "Puzzles": the page title, and "Back to puzzles" on the
puzzle page's back link (now labelled for screen readers and on hover). Home's
link to it reads "All puzzles".

The name dialog after a first solve offers "Not now", which goes where the
page's back link does (home for today's puzzle); its placeholder is just
"fx. Jungleboi87", the label kept for screen readers.

### Sidebar

The sidebar is the page's side column, not its controls. The panel itself
renders the credits row on mobile, so every page has it. On desktop every page
gets the builder link on top and the credits (Ricochet Robots, GitHub,
LinkedIn) at the foot. The puzzle page keeps only "See solves" there, as a
secondary button. Print and the header's builder icon are gone. The home stats
keep their original layout.

### Smaller

- Difficulty is gone from cards and the archive sidebar.
- Desktop pages too tall to centre start at the top (`content-center-safe`).
- The hint dialog puts its main action on the right, like the other dialogs.

## Non-goals

- Retro themes: they still style the old pieces and get their own pass
  (TODO.md → UI).
- Removing difficulty from the data; it stays on solutions and candidate pages.

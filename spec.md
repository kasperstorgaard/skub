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
  lead ("Daily puzzle #309", then the name); on pages it's a light, muted line
  above the name.
- The home wordmark sits at 700 and swells once, barely, on load.

### Surface

- **Pearl** (brand → link with a soft sheen) is a design token. Buttons wear it
  as a ring: full on primary, faint on secondary, full again on hover; hover
  fills at half strength. Disabled buttons get a flat ring, not a faded pearl.
  The Flash bolt fills with it when Flash is on.
- **Grain**: a fine noise texture over the page backdrop, blended (overlay) so
  it moves around each theme's surface colour instead of lifting it toward
  grey.
- **`--color-panel`**: the sidebar's own colour. It defaults to `surface-2`;
  skub, dracula and acid set a deep shade of their own.
- Retro and high-contrast themes keep their own looks for all of the above.

### Playing a puzzle

- **Toolbar beside the board**, sharing the editor's toolbar layout: undo,
  redo, hint and start over with their keys, plus a note that arrow keys and
  TAB move. A column to the board's right on desktop, a row under it on
  mobile. Nudges move under the board.
- **Score badge** replaces the difficulty badge and the move counter: moves
  played over the shortest solution ("3/10", or "3/?" until solved), behind the
  Flash switch when the puzzle has a Flash start.

### Sidebar

The sidebar is the page's side column, not its controls. On desktop every page
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

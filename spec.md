# Retro themes that differ in more than colour

## Problem

Themes diverge on colour only: fourteen tokens in `styles/themes.css`, all
bundled into the one stylesheet whether a player uses them or not. The design
is clean but flat; no theme carries an identity of its own.

## Approach

Keep the existing themes, and add a new kind next to them: Retro themes, each
a kitsch reference from the 90s and 2000s and each a *slight* variation on
the current design: same spacing, same layout, same board rules, but its own
fonts, shape (radius, border weight, angles), texture (noise, grain,
scanlines) and light (gradients, glows). The picker groups themes by section
rather than by mode: Dark and Light for the existing colour themes, Retro for
the new ones (light or dark doesn't describe them), and Accessibility for
High Contrast. Existing themes that don't pull their weight may be pruned
later.

Each theme is one CSS file in `styles/themes/`, built as a hashed asset by
`plugins/theme-css.ts`, and only the active one is linked from `_app.tsx`,
with its fonts preloaded. `skub`'s tokens are the `:root` defaults in
`styles.css`, so an unknown stored theme key (a retired one)
renders as `skub`. In dev the plugin serves theme files and fonts itself:
Fresh's dev server only hands Vite a URL already in its module graph, which a
linked stylesheet never enters.

Theme files override components directly through a small set of stable class
hooks (`.board`, `.board-space`, `.board-puck`, `.panel`, `.puzzle-card`,
`.puzzle-card-difficulty`, `.difficulty-badge`, `.move-counter`, …) plus
`.btn`/`.icon-btn`, `dialog`, `header`. Theme files are unlayered, so they win
over Tailwind utilities; a theme that sets a button background must restate
the hover and primary fills, which `buttons.css` keeps in a layer. They lean on Open Props values:
`--gradient-*`, `--noise-*`, `--mask-corner-cut-*`, `--radius-*`,
`--border-size-*`. Tokenising what the themes end up sharing is deliberately
left for after the themes look right.

Fonts are OFL families from Fontsource, latin subset, self-hosted next to
Chakra Petch. Each theme pairs a display face (headings, buttons) with a body
face.

The board is the most important surface in the app: themes may restyle tile
borders, radius and piece shape, but never spacing, contrast between pieces,
or motion.

## The themes

| Key | Section | Reference | Fonts |
|---|---|---|---|
| `skub` | dark | unchanged baseline | Chakra Petch |
| `high-contrast` | accessibility | a11y; tertiary text a touch brighter | Chakra Petch |
| `dracula`, `acid` | dark | existing colour themes, unchanged | Chakra Petch |
| `catppuccin`, `solarized-light`, `ember` | light | existing colour themes, unchanged | Chakra Petch |
| `digicam` | retro | early-2000s digital camera: rose palette, film grain, viewfinder brackets on the board, white buttons with black text | Space Grotesk + VT323 |
| `matrix` | retro | The Matrix (1999): lime phosphor, mirrored glyph rain behind the page, scanlines, outline buttons that glow, corner cuts | Michroma + JetBrains Mono |
| `moquette` | retro | the London Underground (c. 1990): the page is a Tube seat moquette woven tone on tone, full colour only behind open dialogs; the board keeps its shape, with pieces in tube line colours (Circle-yellow puck, Hammersmith & City pink target, Trams green blockers, Central-red walls); white wordmark, Underground red buttons, white-on-blue station name boards for labels and card taglines; no roundel (TfL trademark) | Railway Sans (Johnston revival) |
| `sash` | retro | 1997 Eurodance CD cover: ultramarine to violet, lens flare, laser rays, chrome lettering and buttons, glowing laser walls, glossy pucks | Exo 2 (ExtraBold Italic display) |
| `geocities` | retro | a 1998 homepage: tiled starry-sky background, rainbow WordArt title and rainbow rules, grey Win95 bevelled buttons, dark Minesweeper tiles, hit-counter moves, hazard-striped dialogs | Tinos + Comic Neue |
| `dookie` | retro | the 1994 album cover as a cartoon: cream, sky blue, mustard, tomato, thin black outlines wobbled by an SVG turbulence filter, pucks with faces | Luckiest Guy + Nunito |
| `discman` | retro | a late-90s portable CD player in daylight: matte brushed aluminium, rubbery silver keys, a backlit LCD with segment digits for the counter, wide device lettering and labels ("Anti-skip · Digital mega bass"), CD-rainbow sheen on the wordmark, difficulty tag and the puck (a tiny disc, on trial) | Syncopate + Manrope + DSEG7 Classic |
| `riso` | retro | 90s risograph zine: two-ink overprint in pink and teal, halftone, zero radius, thick borders | Archivo Black + Archivo |

Dookie's wobble is an inline SVG `<filter>` rendered by `_app.tsx` only when
that theme is active: Chromium ignores a CSS `filter: url()` that points into
a separate SVG file or data URI.

Railway Sans and DSEG7 ship as their authors' unmodified files: their OFL
licences reserve the font names, and subsetting or converting counts as modifying it,
so the theme plugin and the font preloads accept `.woff` as well as `.woff2`.

## Non-goals

- A shared shape/texture token layer. Comes after, from what the themes share.
- Loading optimisation beyond "one theme file per request". Measured at the end.
- Changing `skub` or the existing colour themes. `high-contrast` only gets a
  slightly brighter tertiary text and its own Accessibility section.

## Status

The Retro lineup is set: the 90s/2000s kitsch references are in place and
each has had at least a first pass. The existing colour themes are back
beside them, each in its own file. Riso is signed off. The rest are
recognisable but still lean on their gimmick; the next pass is refinement,
theme by theme, until each is enjoyable to play in rather than a novelty.

Dropped along the way for lacking a reference people recognise: Kiln, Noir,
Classic Web, Bondi (iMac G3), Wes (Wes Anderson) and Trek (Star Trek, as
LCARS and as the original series).

Still open: the refinement pass, a token pass over what the theme files
share, the loading pass, and removing the "theme with more edge" TODO entry.

# Eight themes that differ in more than colour

## Problem

Themes diverge on colour only: fourteen tokens in `styles/themes.css`, all
bundled into the one stylesheet whether a player uses them or not. The design
is clean but flat, and five of the seven themes are editor palettes
(Dracula, Solarized, …) that carry no identity of their own.

## Approach

Keep `skub` and `high-contrast` as they are. Replace the five editor themes
with six new ones, each a *slight* variation on the current design: same
spacing, same layout, same board rules, but its own fonts, shape (radius,
border weight, angles), texture (noise, grain, scanlines) and light (gradients,
glows). Eight themes total.

Each theme is one CSS file in `styles/themes/` and only the active one is
linked from `_app.tsx`, with its fonts preloaded. `skub` is the `:root`
default in `styles.css`, so an unknown stored theme key (a player who had
`dracula`) renders as `skub` with no extra request.

Theme files override components directly through a small set of stable class
hooks (`.board`, `.board-space`, `.board-puck`, `.panel`, `.puzzle-card`, …)
plus `.btn`/`.icon-btn`, `dialog`, `header`. They lean on Open Props values:
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

| Key | Mode | Direction | Fonts |
|---|---|---|---|
| `skub` | dark | unchanged baseline | Chakra Petch |
| `high-contrast` | dark | unchanged, a11y | Chakra Petch |
| `digicam` | dark | 2000s hipster, early digital camera: rose palette, film grain, zero radius, thin light borders, a light-leak gradient | Space Grotesk + VT323 |
| `acid` | dark | neon terminal: corner-cut angles, hairline borders, faded neon glows, glitch on hover | Michroma + JetBrains Mono |
| `nocturne` | dark | Dracula palette: soft radius, purple-to-pink gradient edges, velvety depth | Sora + DM Sans |
| `classic` | light | a document from the early web: white, black serif, link blue as the only colour, table grid, no radius | system Georgia + Arial |
| `kiln` | light | Ember palette: clay gradients, generous radius, soft inset depth | Bricolage Grotesque + Nunito Sans |
| `riso` | light | risograph: two-ink overprint in pink and teal, halftone noise, zero radius, thick borders | Archivo Black + Archivo |

## Non-goals

- A shared shape/texture token layer. Comes after, from what the themes share.
- Loading optimisation beyond "one theme file per request". Measured at the end.
- Changing `skub` or `high-contrast`.

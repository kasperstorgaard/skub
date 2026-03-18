# Skub

A sliding-piece puzzle game inspired by
[Ricochet Robots](https://en.wikipedia.org/wiki/Ricochet_Robots).

Guide the puck to its destination - but pieces continue until they hit
something.

**[Play it now](https://ricochet.kasperstorgaard.deno.net/)**

## Demo

https://github.com/user-attachments/assets/aeda00d9-e2a5-4814-830c-f34db20361cc

## Features

- **Progressive enhancement** — full server-side state management and, works
  without JavaScript
- **Touch & keyboard** — swipe on mobile, arrow-keys or `u`/`r`/`h` shortcuts on
  desktop
- **CSS-only replays** — animated solution playback, no JS animation libraries
- **Smart solver** — BFS-based solver finds optimal solutions and powers the
  hint system
- **Dark/light theme** — follows system preference
- **Puzzle editor** — create, generate, and share your own puzzles with a
  live-solving minimum moves badge
- **Leaderboards** — compare your solution against others

## Editor

https://github.com/user-attachments/assets/c1c1c2fd-defb-48a7-9622-1df74779787e

The built-in editor lets you create puzzles from scratch or generate random
solvable boards with configurable minimum moves. A debounced solver runs on every
edit, showing the optimal solution length in real time. Use **Download** to
export a puzzle as a `.md` file and **Import** to load one back in.

## Tech Stack

| Layer     | Tech                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| Runtime   | [Deno](https://deno.land)                                                            |
| Framework | [Fresh 2](https://fresh.deno.dev)                                                    |
| UI        | [Preact](https://preactjs.com) + [Signals](https://preactjs.com/guide/v10/signals/)  |
| Styling   | [Tailwind CSS v4](https://tailwindcss.com) + [Open Props](https://open-props.style/) |
| Storage   | [Deno KV](https://deno.com/kv)                                                       |
| Touch     | [ZingTouch](https://zingchart.github.io/zingtouch/)                                  |
| Build     | [Vite](https://vite.dev)                                                             |

## Getting Started

Requires [Deno](https://deno.land/manual/getting_started/installation).

```bash
# Start dev server with file watching
deno task dev

# Build for production
deno task build

# Preview production build
deno task preview
```

## Project Structure

```
routes/          File-system routes (pages + API)
islands/         Interactive Preact components (hydrated client-side)
components/      Static server-rendered components
game/            Core game logic (board, solver, parser, types, cookies)
client/          Browser-only code (touch, keyboard, routing)
lib/             Portable utilities (env, analytics, replay, build tools)
db/              Deno KV database layer
static/puzzles/  Puzzle definitions in Markdown + ASCII
```

## Puzzle Format

Puzzles are Markdown files with YAML frontmatter and an ASCII board:

```markdown
---
name: My Puzzle
slug: my-puzzle
createdAt: 2025-06-15T00:00:00.000Z
---

+ A B C D E F G H +
1 #     #         |
2   X             |
3    |            |
4                 |
5                 |
6         @       |
7                 |
8 #               |
+-----------------+
```

Symbols: `@` = puck (player piece), `X` = destination, `#` = blocker,
`|` = vertical wall, `_` = horizontal wall.

The easiest way to create a puzzle is via the in-app editor at `/puzzles/new`.
Design your board, then click **Download** to save the `.md` file. Use
**Import** to load it back into the editor later. Place it in
`static/puzzles/` and run `deno task update-puzzles` to register it.

## Privacy

This site uses [PostHog](https://posthog.com) for product analytics.
Tracking is **opt-in** — no data is collected until you accept via the cookie banner.
Data is processed by posthog in the eu, and not shared with other third parties.

## License

MIT

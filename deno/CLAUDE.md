# Skub — Deno app

The live Deno app: Deno + Fresh 2 + Preact. Run everything here from `deno/`. Repo-wide rules (skills, branches, planning) are in the root `CLAUDE.md`.

## Commands

```bash
deno task dev            # Dev server with file watching
deno task build          # Production build
deno task preview        # Preview production build

deno fmt                 # Format code (Deno's built-in formatter)
deno lint                # Lint (fresh + recommended rules)
deno test -A             # Run all unit tests

deno task update-puzzles # Regenerate puzzle manifest after adding puzzles
```

CI runs: `deno fmt --check`, `deno lint`, `deno test -A`, then
`deno task build` and `deno task check-css`.

## Project Layout

```
routes/          File-system routing (pages + API endpoints)
islands/         Interactive Preact components — hydrated client-side
components/      Static server-rendered components — no client JS
game/            Core game logic (board, solver, parser, types, cookies)
client/          Browser-only code (touch, keyboard, routing)
lib/             Portable utilities (env, analytics, replay, build tools)
db/              Deno KV operations
static/puzzles/  Puzzle definitions (.md files with ASCII boards)
plugins/         Vite plugins (puzzle manifest generation)
```

**Where logic lives**:
- `game/` — pure game logic, no browser APIs, safe to import server-side
- `client/` — client-side only (DOM, touch, signals, browser state)
- `lib/` — portable utilities with no game or browser knowledge
- `db/` — Deno KV access, server-side only

**Import alias**: Use `#/` for project-root imports (e.g., `import type { Board } from "#/game/types.ts"`).

For routing, state, and storage decisions → `/architecture`.

## Core Types

All domain types are in `game/types.ts`. Key types:
- `Board` — `{ destination: Position, walls: Wall[], pieces: Piece[] }`
- `Piece` — `Position & { type: "puck" | "blocker" }`
- `Wall` — `Position & { orientation: "horizontal" | "vertical" }`
- `Move` — `[Position, Position]` (from → to)
- `Puzzle` — `{ slug, name, board, createdAt, minMoves?, difficulty }`

## Adding Puzzles

Create `static/puzzles/<slug>.md` with YAML frontmatter + ASCII board:

```markdown
---
name: Boxy
slug: boxy
createdAt: 2026-01-26T00:00:00.000Z
difficulty: medium
minMoves: 10
---

+ A B C D E F G H +
1                 |
2   # _ _ _ _ @   |
3    |       |    |
4            |    |
5            |    |
6    |_ _ X̲ _|    |
7   #         #   |
8                 |
+-----------------+
```

Symbols: `@` = puck (player piece), `X` = destination, `#` = blocker, `|`/`_` = walls.

Run `deno task update-puzzles` after adding puzzles to regenerate the manifest.

## Styling & Components

Always use Tailwind utility classes. Use `clsx` for conditional class composition. Prefer HTML semantics and native elements first.

For Tailwind conventions, design tokens, component patterns, islands architecture, and progressive enhancement → `/frontend`.

## TypeScript Conventions

- **File naming**: kebab-case for all files (e.g. `my-component.tsx`, `some-util.ts`)
- **Test files**: `*_test.ts` suffix (Deno convention, e.g. `board_test.ts`)
- **Fresh routes**: Always use `define.handlers<PageData>()` from `core.ts` for route handlers — this wires in the shared `State` type automatically. Use `typeof handler` to infer page props rather than declaring them manually:

```ts
import { define } from "#/core.ts";

export const handler = define.handlers<PageData>({ ... });
export default define.page<typeof handler>();
```

- **Inference first** — don't annotate what the compiler can figure out.
- **Avoid** `enum` (use string unions), `interface` (use `type`), `!` non-null assertions, `any`.
- **Function arguments** — max 3, ordered by essentialness. Exceed this only for performance-critical functions where object allocation overhead matters. Use domain-specific names, not generic placeholders:
  1. **Target** — what the function is *about*. Always required.
  2. **Subject/source** — what drives the operation. Subject = actor/trigger (computations). Source = data being consumed (transforms).
  3. **Options** — modifiers that tune behaviour. Optional, but default values are encouraged over requiring callers to pass everything.

  Generic names (`src`, `target`) are reserved for utilities so abstract they have no domain vocabulary. Everywhere else, name from the domain. When an argument doesn't fit neatly, collapse it into `options`.

  This ordering applies to functions with meaningful return values or domain computations. Side-effect-only functions (analytics calls, fire-and-forget mutations) are exempt — there is no target being transformed, so natural readability takes precedence.

## Tests

Invoke `/architecture` for testing decisions. Philosophy: test game logic exhaustively with realistic scenarios, skip client-side hooks and third-party wrappers. `*_test.ts` suffix, co-located with the module under test, one scenario per `Deno.test()`.

## Analytics

Invoke `/product` for tracking decisions. Events are server-side only (posthog-node), camel_case naming (`puzzle_solved`), 1–3 meaningful events per feature — no generic clicks, no page-load events (use pageviews instead).

## Environment



## Tech Notes

- **Deno KV** (unstable): Enabled via `"unstable": ["kv"]` in deno.json.
- **BFS Solver** (`game/solver.ts`): Throws `SolverLimitExceededError` / `SolverDepthExceededError` on unsolvable/too-complex boards.
- **Progressive enhancement**: Game works fully server-side without JavaScript. Don't break this.

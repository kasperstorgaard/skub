# Skub — Agent Guidelines

A sliding-piece puzzle game (Ricochet Robots-inspired) built with Deno + Fresh 2 + Preact.

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

CI runs: `deno fmt --check`, `deno lint`, `deno test -A`.

## Skills

Invoke the relevant skill automatically when the task matches — no need to wait for the user to ask:

- **`/product`**
  TRIGGER when: evaluating whether to build something, deciding what to track, or considering how a feature fits the game's goals.
  DO NOT TRIGGER when: the task is purely technical with no product trade-off involved.

- **`/architecture`**
  TRIGGER when: adding new pages or routes, writing API handlers, or working with KV/cookies/state storage.
  DO NOT TRIGGER when: refactoring UI or fixing UI bugs.

- **`/frontend`**
  TRIGGER when: writing or reviewing components, Tailwind classes, CSS, islands, or anything visual or interactive.

- **`/testing`**
  TRIGGER when: writing, reviewing, or deciding what to test.


## Branches & PRs

A PR should be reviewable as a single unit of thought. The test: could a reviewer evaluate this change without also having to reason about something unrelated?

Split into a separate branch when a change:
- Belongs to a different topic (e.g. onboarding UX in an infrastructure PR)
- Has its own regression risk or edge cases to test
- Would pull reviewer focus away from the main change

Size doesn't matter — a one-liner on a different topic still belongs elsewhere. When a tangential change comes up mid-task, branch off, make the change, then return.

## Planning

When planning work before implementation, write the plan to `spec.md` at the project root and commit it. On every push, CI auto-populates the PR body between `<!-- spec:start -->` / `<!-- spec:end -->` markers with the current spec content.

On merge to main, the `archive-spec` workflow automatically moves `spec.md` to `specs/<branch-slug>.md` — no manual step needed.

Past specs live in `specs/` — excluded from context by default, reference them explicitly if needed.

**Agent behaviour:**
- If `spec.md` exists and substantial changes are made outside of plan mode, update `spec.md` to reflect what was actually built.
- If `spec.md` does not exist and the changes are substantial, ask whether one should be created.

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

## Environment & Deployment

- **`.env`**: Used for local development only (PostHog keys, KV tokens, etc.) — not checked in
- **Deployment target**: [console.deno.com](https://console.deno.com) — environment variables and secrets are configured there, not in the repo
- **CI/CD**: Deno Deploy generates a GitHub Action automatically — it is not checked into `.github/workflows/`
- **`manifest.json`**: Auto-generated by the Vite puzzle plugin at build time. Never edit it manually — it will be overwritten

## Tech Notes

- **Deno KV** (unstable): Enabled via `"unstable": ["kv"]` in deno.json.
- **BFS Solver** (`game/solver.ts`): Throws `SolverLimitExceededError` / `SolverDepthExceededError` on unsolvable/too-complex boards.
- **Progressive enhancement**: Game works fully server-side without JavaScript. Don't break this.

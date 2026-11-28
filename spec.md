# Repo split: move the Deno app into `deno/`

Step 0 of the [Cloudflare move](docs/cloudflare-move/rollout.md#0-repo-split).

## Problem

The new app gets built beside the Deno app as `web/`. Today the Deno app
fills the repo root, so there is no room for a second app with its own
toolchain.

## Approach

`git mv` the whole Deno app into `deno/`, unchanged. The root keeps only
repo-wide files: docs, specs, workflows, skills, editor and agent config,
`TODO.md`, `spec.md`, `README.md`, `LICENSE`.

- **Code is untouched.** Paths are cwd-relative (`Deno.cwd()`,
  `./static/puzzles`), so they work once commands run from `deno/`.
- **CI:** `pull-request.yml` and `e2e.yml` run in `deno/` and filter on
  `deno/**`. The e2e blast-radius globs get the `deno/` prefix, since
  `select-e2e-tests` sees repo-rooted paths.
- **Tooling:** `paseo.json` runs dev from `deno/`; VS Code enables Deno for
  `deno/` only.
- **CLAUDE.md splits.** The root keeps branches and PRs, planning and skill
  triggers. Commands, layout, core types, puzzles and tech notes move to
  `deno/CLAUDE.md`. Skills that name paths get the `deno/` prefix.
- **Local-only files** (`.env`) move into `deno/` and `.worktreeinclude`
  follows.

## Rollout

The Deno Deploy app directory is app-wide, and this branch only builds after
it flips to `deno/`. Order: flip the setting, rebuild this branch, check its
branch URL, merge straight away. Nothing else merges in between. Other open
branches need a rebase onto the move.

## Non-goals

- Any behaviour change in the Deno app.
- The `web/` app or its toolchain (step 0.5).

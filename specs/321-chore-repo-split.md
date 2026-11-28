# Repo split: move the Deno app into `deno/`

Step 0 of the [Cloudflare move](docs/cloudflare-move/rollout.md#0-repo-split).

## Problem

The new app gets built beside the Deno app as `web/`. Today the Deno app fills
the repo root, so there is no room for a second app with its own toolchain.

## Approach

`git mv` the whole Deno app into `deno/`, unchanged. The root keeps only
repo-wide files: docs, specs, workflows, skills, editor and agent config,
`TODO.md`, `spec.md`, `README.md`, `LICENSE`.

- **Code is untouched.** Paths are cwd-relative (`Deno.cwd()`,
  `./static/puzzles`), so they work once commands run from `deno/`.
- **CI:** `pull-request.yml` and `e2e.yml` run in `deno/`. Repo-wide files are
  format-checked from the root. No path filters yet: `verify` and `e2e tests`
  are required checks, and a filtered-out workflow never reports, so filtering
  waits for step 0.5's `web/` jobs. `select-e2e-tests` strips the `deno/` prefix
  from git's repo-rooted paths, so the blast-radius globs stay as they are.
- **Tooling:** `paseo.json` runs dev from `deno/`; VS Code enables Deno for
  `deno/` only.
- **CLAUDE.md splits.** The root keeps branches and PRs, planning and skill
  triggers. Commands, layout, core types, puzzles and tech notes move to
  `deno/CLAUDE.md`. Skills that name paths get the `deno/` prefix.
- **Local-only files** (`.env`) move into `deno/` and `.worktreeinclude`
  follows.

## Rollout

The Deno Deploy app directory is app-wide, and this branch only builds after it
flips to `deno/`. Order: flip the setting, rebuild this branch, check its branch
URL, merge straight away. Nothing else merges in between. Other open branches
need a rebase onto the move.

## Non-goals

- Any behaviour change in the Deno app.
- The `web/` app or its toolchain (step 0.5).

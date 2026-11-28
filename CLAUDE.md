# Skub — Agent Guidelines

A sliding-piece puzzle game (Ricochet Robots-inspired) built with Deno + Fresh 2 + Preact.

> **Keep this file light.** Detailed conventions belong in `.claude/skills/` as
> named skill files. This file should contain only what can't live in a skill:
> repo layout, skill triggers, and workflow.

## Layout

- `deno/` — the live Deno app. Commands, project layout and code conventions are in `deno/CLAUDE.md`.
- `web/` — the new app, coming in step 0.5. See `docs/cloudflare-move/`.
- `.github/`, `.claude/skills/`, `docs/`, `specs/` — repo-wide.

Run app commands from the app's directory (`cd deno`).

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

- **`/observability`**
  TRIGGER when: adding OTEL spans or attributes, naming spans, or deciding what to instrument.


## Branches & PRs

A PR should be reviewable as a single unit of thought. The test: could a reviewer evaluate this change without also having to reason about something unrelated?

Split into a separate branch when a change:
- Belongs to a different topic (e.g. onboarding UX in an infrastructure PR)
- Has its own regression risk or edge cases to test
- Would pull reviewer focus away from the main change

Size doesn't matter — a one-liner on a different topic still belongs elsewhere. When a tangential change comes up mid-task, branch off, make the change, then return.

## Planning

When planning work before implementation, write the plan to `spec.md` at the project root and commit it. When the PR is opened, CI populates the PR body between `<!-- spec:start -->` / `<!-- spec:end -->` markers with the current spec content.

On merge to main, the `archive-spec` workflow automatically moves `spec.md` to `specs/<pr-number>-<branch-slug>.md` — no manual step needed.

Past specs live in `specs/` — excluded from context by default, reference them explicitly if needed.

Agreed-but-unscheduled work lives in `TODO.md`, phrased as user-level outcomes. The PR that finishes an item deletes it from there in the same change.

**Spec content:** describe *intent* — the problem, the approach, and non-goals if helpful. Don't enumerate changed files; `git diff` and the PR Files tab are the authoritative record and won't drift. The exception is pre-implementation planning when the files don't exist yet and listing them communicates scope.

**Agent behaviour:**
- If `spec.md` exists and substantial changes are made outside of plan mode, update `spec.md` to reflect what was actually built.
- If `spec.md` does not exist and the changes are substantial, ask whether one should be created.

## Environment & Deployment

- **`deno/.env`**: Used for local development only (PostHog keys, KV tokens, etc.) — not checked in
- **Deployment target**: [console.deno.com](https://console.deno.com) — environment variables and secrets are configured there, not in the repo
- **CI/CD**: Deno Deploy generates a GitHub Action automatically — it is not checked into `.github/workflows/`

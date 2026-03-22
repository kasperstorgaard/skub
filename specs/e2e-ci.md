# E2E CI — Spec

## Goal

Run e2e tests automatically after each successful Deno Deploy preview build,
with AI-driven test selection so only relevant tests run per PR.

## Trigger

Deno Deploy fires a `repository_dispatch` event (`deno_deploy.build.routed`)
after each successful build. The payload includes:

- `revision.preview_url` — the live preview URL to test against
- `revision.git.sha` — the commit SHA (used to compute the diff for test selection)

No webhook config needed — Deno Deploy sends this automatically.

## Workflow (`.github/workflows/e2e.yml`)

Steps:
1. **Select tests** (`continue-on-error`) — run `scripts/select-e2e-tests.ts`;
   Claude returns which test files to run (or none). Errors here are treated as
   "no tests" so CI infrastructure issues never block a PR.
2. **Skip** if selection is empty — job still reports success for branch protection.
3. **Install Playwright** — `npx playwright install chromium --with-deps`
4. **Run** `deno test -A --no-check <files>` with `BASE_URL` pointing at the
   preview URL and `E2E_SECRET` for seed route auth.

## Seeding

Tests seed and tear down user data via `POST /api/e2e/seed` and
`DELETE /api/e2e/seed` on the preview deployment itself. The route uses the
same KV instance as the app, protected by an `x-e2e-secret` header.
No direct KV access from the runner — no KV URL or token needed in CI.

`E2E_SECRET` must be set both as a GitHub repo secret (runner → seed route)
and as a Deno Deploy environment variable (app validates it).

## AI test selection (`scripts/select-e2e-tests.ts`)

```
input:  git diff origin/main...<sha> --unified=0
        spec.md contents (if present) — describes PR intent
        full contents of all e2e/*_test.ts files (discovered dynamically)
output: JSON array of file paths to run, or []
```

Single Claude API call (`claude-opus-4-6`) with structured JSON output.
If `spec.md` exists on the branch it is passed first as higher-level context.
Test files are discovered via `Deno.readDirSync("e2e")` — no hardcoded list.

## Secrets needed

| Secret | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | GitHub repo | AI test selection |
| `E2E_SECRET` | GitHub repo + Deno Deploy env | Seed route auth |

## What's not in scope

- Parallelising test files across workers
- Retries on flaky tests

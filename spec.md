# Plan the move to Cloudflare

Deno Deploy shuts down around April 2027, Deno runtime development ends a year
after the October 2026 Deno–Cloudflare deal, and Fresh won't be maintained.
Skub needs a new runtime, host, store, framework and toolchain.

The plan: build the new app in parallel in the same repo, on Cloudflare
Workers with one SQLite Durable Object and Astro 7 + Preact islands. Run it on
`next.skub.app` with a one-way import of real data, and make the switch (a DNS
change) once it's bug-free. Until then the repo is a temporary monorepo: the
Deno app in `deno/`, the new app in `web/`, no shared code.

This PR writes the plan down. No code changes.

## Docs

The docs in `docs/cloudflare-move/` are the source of truth:

- [mission.md](docs/cloudflare-move/mission.md): the game's mission: the
  product north star, tone of voice and measurable goals.
- [architecture.md](docs/cloudflare-move/architecture.md): the north star,
  the architecture counterpart of the mission. Every PR is reviewed against it.
- [rollout.md](docs/cloudflare-move/rollout.md): why we're moving, the switch
  criterion, the repo layout, the spikes
  with success criteria and fallbacks, steps 0–8 (with 0.5, rules and guardrails), the switch runbook, rollback
  and risks.
- [harness.md](docs/cloudflare-move/harness.md): the tooling that keeps Skub
  moving toward the north star, per step.
- [decisions.md](docs/cloudflare-move/decisions.md): every decision with its
  alternatives and reasons.
- [parity.md](docs/cloudflare-move/parity.md): every flow and route of the
  Deno app, its e2e coverage today, and porting progress.
- [2026-11-24-meeting-notes.md](docs/cloudflare-move/2026-11-24-meeting-notes.md):
  the raw notes they come from.

## Non-goals

- Starting the build. The spikes are done; the next PR is PR 0, the repo split.
- Filling parity.md's "keep?" column. A separate review does that.

# Spikes

Throwaway spikes from [the rollout](../rollout.md#spikes-throwaway-done). Each
runs in its own worktree on its own branch, branched from
`plan/cloudflare-migration-research`, commits WIP checkpoints, and writes its
findings to `spikes/<name>.md` on that branch. Findings are folded into the plan
docs here once they land. Nothing is pushed from a spike branch.

| Spike                  | Branch                | Question                                                                                                                                                          | Status                                       |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Shared signals         | — (code audit)        | Does one island root per page hold?                                                                                                                               | Done: [shared-signals.md](shared-signals.md) |
| Solver budget          | `spike/solver-budget` | Hint and editor state budgets in a browser Web Worker; TS, compact TS or Rust → WASM?                                                                             | Done: [solver-budget.md](solver-budget.md)   |
| Astro on workerd       | `spike/astro-workerd` | Astro + Preact in workerd, island root + slots, ClientRouter, no-JS 303, SQLite DO, lazy solver worker, budgets, `cf` vs Wrangler, previews and the DO round trip | Done: [astro-workerd.md](astro-workerd.md)   |
| Offline service worker | `spike/offline-sw`    | Hand-written SW, overlay, offline Home, outbox 202 + replay, deploy survival                                                                                      | Done: [offline-sw.md](offline-sw.md)         |
| Bun toolchain          | `spike/bun-toolchain` | `bun test` on shared tests, dual-runtime tests, Temporal, Oxlint plugin + `game/` boundary, TS 7, CI                                                              | Done: [bun-toolchain.md](bun-toolchain.md)   |

## Ground rules

- Dev servers and headless Playwright only inside the spike's worktree, on its
  own port (4411–4413) and data, stopped when done. Never the Paseo dev service.
- Cloudflare deploys only as `spike-*` Workers on `*.workers.dev`: no routes,
  custom domains, zones or DNS, nothing touching `skub.app`, no secrets.
  Everything created is deleted afterwards and listed in the write-up.

## Resuming

Spike worktrees live under `.claude/worktrees/` in the main checkout. Check the
branch's `git log` and `git status`, then continue from the WIP commits and the
write-up path above.

# Hint worker

## Problem

The hint route ran `solveSync` inside the request handler: on the isolate's only
thread, with the default 10M-state budget, outside the per-isolate `solveLock`
that guards `/api/solve`. Each hint blocked every other request on the isolate
for the length of the solve. During the 2026-10-09 crawler burst (see #237)
that showed up as multi-second CPU spikes and isolates killed for memory.

## Approach

Hints get the editor's protections:

- **Solve in the worker.** The worker URL and `solveLock` move out of
  `/api/solve` into a shared module, so hints and editor solves queue on the same
  lock — one solve per isolate at a time, off the main thread.
- **Per-request budget.** The worker takes its state budget in the message: 3M
  for editor solves (unchanged), 7M for hints. Shipped boards are vetted, and the
  growable solver arrays mean a hint only allocates what it explores.
- **Abort on disconnect.** A hint whose request goes away stops its worker and
  releases the lock.

## Non-goals

- Crawler protection — hint and clone became POST forms in #237.
- Moving hint solving to the browser. The hint allowance is enforced
  server-side, so that's a separate product call.
- Caching hints by board.

import { Semaphore } from "@std/async/unstable-semaphore";

import type { SolverEvent } from "#/game/solver.ts";
import type { Board, Move } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

// Resolves to a file:// URL at runtime, bypassing Deno Deploy's
// --cached-only restriction (which only blocks HTTP module fetches).
// The Vite plugin copies solver-worker.js to _fresh/server/assets/
export const workerUrl = isDev
  ? new URL("./solver-worker.ts", import.meta.url).href
  : new URL("./solver-worker.js", import.meta.url);

/**
 * BFS state budget for an editor solve. `bfsExplore` grows its pool as states
 * are found, so the cap is a request's worst case — a board that runs it out
 * measures ~175MB, visited set included.
 *
 * That doubles as the bound on a public endpoint, which is why it stays well
 * under the analysis budget. A hand-built board rarely passes 100K, but a
 * composed one carries hazards and more reachable geometry, and 500K was running
 * out on boards that do have an answer.
 */
export const EDITOR_MAX_STATES = 3_000_000;

/** BFS state budget for a hint. Higher than the editor's: shipped boards are vetted. */
export const HINT_MAX_STATES = 7_000_000;

export type SolveRequest = { board: Board; maxStates: number };

// One solve at a time per isolate, so memory stays bounded by one budget.
export const solveLock = new Semaphore(1);

/**
 * Solves `board` in the solver worker, queued behind any other server solve.
 * Rejects when the worker reports an error or `signal` aborts.
 */
export async function solveInWorker(
  board: Board,
  options: { maxStates: number; signal?: AbortSignal },
): Promise<Move[]> {
  const { maxStates, signal } = options;
  const permit = await solveLock.acquire();
  let worker: Worker | undefined;

  try {
    signal?.throwIfAborted();
    const solver = worker = new Worker(workerUrl, { type: "module" });

    return await new Promise<Move[]>((resolve, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });

      solver.onmessage = (e: MessageEvent<SolverEvent>) => {
        if (e.data.type === "solution") resolve(e.data.moves);
        if (e.data.type === "error") reject(new Error(e.data.message));
      };

      solver.onerror = (e) => reject(new Error(e.message));

      solver.postMessage({ board, maxStates } satisfies SolveRequest);
    });
  } finally {
    worker?.terminate();
    permit[Symbol.dispose]();
  }
}

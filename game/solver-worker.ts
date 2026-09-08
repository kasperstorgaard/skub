import { solve } from "#/game/solver.ts";
import type { SolverEvent } from "#/game/solver.ts";
import type { Board } from "#/game/types.ts";

/**
 * BFS state budget for an editor solve. The worker runs per request behind
 * /api/solve, and `bfsExplore` pre-allocates the whole pool up front, so the cap
 * is what a request costs — roughly 11 bytes a state on a four-piece board, so
 * ~22MB of server memory per concurrent solve.
 *
 * That doubles as the bound on a public endpoint, which is why it stays well
 * under the analysis budget. A hand-built board rarely passes 100K, but a
 * composed one carries hazards and more reachable geometry, and 500K was running
 * out on boards that do have an answer.
 */
const EDITOR_MAX_STATES = 2_000_000;

self.onmessage = (e: MessageEvent<Board>) => {
  try {
    for (const event of solve(e.data, { maxStates: EDITOR_MAX_STATES })) {
      self.postMessage(event);
      if (event.type === "solution") return;
    }
  } catch (err) {
    const event: SolverEvent = {
      type: "error",
      message: err instanceof Error ? err.message : "Solver failed",
    };
    self.postMessage(event);
  }
};

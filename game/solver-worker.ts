import { solve } from "#/game/solver.ts";
import type { SolverEvent } from "#/game/solver.ts";
import type { Board } from "#/game/types.ts";

/**
 * BFS state budget for an editor solve. Tighter than the gate's and the
 * analysis budget: this one re-runs on every board edit, and `bfsExplore`
 * pre-allocates the whole pool up front, so the cap is what the run costs.
 * Well clear of a hand-built board — medium puzzles stay under 100K states.
 */
const EDITOR_MAX_STATES = 500_000;

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

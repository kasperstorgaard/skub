import type { SolveRequest } from "#/game/solver-queue.ts";
import { getSolverErrorReason, solve } from "#/game/solver.ts";
import type { SolverEvent } from "#/game/solver.ts";

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { board, maxStates } = e.data;
  try {
    for (const event of solve(board, { maxStates })) {
      self.postMessage(event);
      if (event.type === "solution") return;
    }
  } catch (err) {
    const event: SolverEvent = {
      type: "error",
      reason: getSolverErrorReason(err),
      message: err instanceof Error ? err.message : "Solver failed",
    };
    self.postMessage(event);
  }
};

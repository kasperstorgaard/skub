import { parsePuzzle } from "#/game/parser.ts";
import { type BoundCtx, type Metrics, scoreBoard } from "#/game/scoring.ts";
import { solveExhaustiveSync } from "#/game/solver.ts";

/**
 * One board's solve output, deliberately free of anything calibration-dependent:
 * composites are derived from `routes`/`ctx` in-process, so a `CALIBRATION`
 * change never invalidates a cached solve.
 */
export type SolvedBoard = {
  slug: string;
  difficulty: string;
  minMoves: number;
  ctx: BoundCtx;
  /** Per distinct solution, in `scoreBoard` order. */
  routes: Metrics[];
  ms: number;
};

export function solveBoardFile(path: string): SolvedBoard {
  const puzzle = parsePuzzle(Deno.readTextFileSync(path));
  const started = performance.now();
  // Overshoot powers the isolation metrics — offline scoring only; gameplay and
  // the generation gates never pay for it.
  const result = solveExhaustiveSync(puzzle.board, {
    maxDepth: 15,
    overshoot: 2,
  });
  const scored = scoreBoard(puzzle.board, result);

  return {
    slug: puzzle.slug,
    difficulty: puzzle.difficulty,
    minMoves: result.minMoves,
    ctx: {
      minMoves: result.minMoves,
      blockers: puzzle.board.pieces.filter((p) => p.type === "blocker").length,
    },
    routes: scored.perSolution.map((solution) => solution.metrics),
    ms: Math.round(performance.now() - started),
  };
}

// Run as a subprocess by `scripts/lib/boards.ts` so a pathologically branchy
// board OOMs or times out on its own instead of taking the report down.
if (import.meta.main) {
  console.log(JSON.stringify(solveBoardFile(Deno.args[0])));
}

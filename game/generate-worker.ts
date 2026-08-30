import { generate, type GenerateOptions } from "#/game/generator.ts";
import {
  boardCanonicalHash,
  checkGenerationGates,
  checkQualityGates,
  checkStaticGates,
  computeMetrics,
  type GateResult,
  type Metrics,
  scoreBoard,
  type ScoredBoard,
} from "#/game/scoring.ts";
import { solveExhaustiveSync } from "#/game/solver.ts";
import type { Board } from "#/game/types.ts";

/** What the /api/generate route posts to the worker to start a gated run. */
export type GenerateRequest = GenerateOptions & {
  /** Exact minMoves this run is after — picked per run from `MOVE_TARGETS`. */
  targetMoves: number;
  /** Canonical hashes of the existing corpus, for the G3 novelty gate. */
  corpus: string[];
  /** Cap on gate-checked candidates before giving up. */
  maxGateAttempts?: number;
};

/** Streamed as SSE to the client, one per line. */
export type GenerateEvent =
  | { type: "progress"; attempts: number; failedGate?: string }
  | {
    type: "result";
    board: Board;
    attempts: number;
    minMoves: number;
    /** Advisory composite for the winning board — surfaced, not gated on. */
    scored: ScoredBoard;
    /** Board-level metrics (over all solutions) for the score breakdown. */
    metrics: Metrics;
  }
  | { type: "exhausted"; attempts: number }
  | { type: "error"; message: string };

const DEFAULT_MAX_GATE_ATTEMPTS = 500;

/**
 * BFS state budget for each gate solve. Bounds worst-case solve time so a single
 * pathological (e.g. highly symmetric, branchy) candidate can't grind for
 * seconds and freeze the progress count. Generous for the generator's ≤6-piece
 * boards within the difficulty bands; branchier boards reject as G1 and the loop
 * moves on. (The full solver limit is 10M, used when solving real puzzles.)
 */
const GATE_MAX_STATES = 2_000_000;

/**
 * One attempt's full verdict: the static quality gates, then the run's own
 * (G1–G3), then the solve-dependent quality gates. A generated board has to
 * clear both halves — the run's, to be what was asked for, and candidacy's, to
 * be worth keeping.
 */
function gateBoard(
  board: Board,
  targetMoves: number,
  novelty: { corpus: Set<string>; batchHashes: Set<string> },
): GateResult {
  const staticGate = checkStaticGates(board);
  if (!staticGate.passed) return staticGate;

  const generation = checkGenerationGates(board, {
    targetMoves,
    ...novelty,
    // Reject branchy candidates fast so a single slow solve can't freeze the
    // attempt counter — well above what a ≤6-piece board needs.
    maxStates: GATE_MAX_STATES,
  });
  if (!generation.passed) return generation;

  return checkQualityGates(board, generation.result);
}

/**
 * Loops `generate()` → `gateBoard()` until a board solves in exactly
 * `targetMoves` and passes every other gate, or the attempt budget is spent.
 * Emits a `progress` event per attempt (a simple rising count for the UI), then
 * a terminal `result` / `exhausted` / `error`. Runs off the main thread — a run
 * can be hundreds of exhaustive solves.
 *
 * The target is exact and has no fallback: a run that can't hit it reports
 * `exhausted` rather than quietly handing back an easier board. Random layouts
 * skew short (roughly half of solvable boards come in under 5 moves, ~4% at
 * 9–10), so the higher targets legitimately take many more attempts.
 */
self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const {
    targetMoves,
    corpus,
    maxGateAttempts = DEFAULT_MAX_GATE_ATTEMPTS,
    ...options
  } = e.data;
  const corpusSet = new Set(corpus);
  const batchHashes = new Set<string>();

  try {
    for (let attempts = 1; attempts <= maxGateAttempts; attempts++) {
      let board: Board;
      try {
        ({ board } = generate(options));
      } catch {
        // Couldn't produce a valid board this round — count it and retry.
        self.postMessage(
          { type: "progress", attempts } satisfies GenerateEvent,
        );
        continue;
      }

      // Cheapest first: the layout-only gates reject a hopeless board before it
      // ever reaches a solve, then the run's own gates, then candidacy.
      const gate = gateBoard(board, targetMoves, {
        corpus: corpusSet,
        batchHashes,
      });

      if (gate.passed) {
        batchHashes.add(boardCanonicalHash(board));
        // Score the winner once for the advisory panel. Same state cap as the
        // gate solve — the board just solved within it, and the cap also sizes
        // the solver's pre-allocated buffers (default 10M ⇒ ~120 MB for nothing).
        // Overshoot powers the isolation advisory; it's paid once per accepted
        // board, never per attempt, and truncates at the cap instead of failing.
        const result = solveExhaustiveSync(board, {
          maxDepth: targetMoves,
          maxStates: GATE_MAX_STATES,
          overshoot: 2,
        });
        self.postMessage(
          {
            type: "result",
            board,
            attempts,
            minMoves: result.minMoves,
            scored: scoreBoard(board, result),
            metrics: computeMetrics(board, result),
          } satisfies GenerateEvent,
        );
        return;
      }

      self.postMessage(
        {
          type: "progress",
          attempts,
          failedGate: gate.failedGate,
        } satisfies GenerateEvent,
      );
    }

    self.postMessage(
      { type: "exhausted", attempts: maxGateAttempts } satisfies GenerateEvent,
    );
  } catch (err) {
    self.postMessage(
      {
        type: "error",
        message: err instanceof Error ? err.message : "Generation failed",
      } satisfies GenerateEvent,
    );
  }
};

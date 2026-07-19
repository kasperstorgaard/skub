import { generate, type GenerateOptions } from "#/game/generator.ts";
import {
  boardCanonicalHash,
  checkGates,
  computeMetrics,
  type Metrics,
  scoreBoard,
  type ScoredBoard,
} from "#/game/scoring.ts";
import { solveExhaustiveSync } from "#/game/solver.ts";
import type { Board, Difficulty } from "#/game/types.ts";

/** What the /api/generate route posts to the worker to start a gated run. */
export type GenerateRequest = GenerateOptions & {
  difficulty: Difficulty;
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
 * Loops `generate()` → `checkGates()` until a board passes every gate at the
 * requested difficulty, or the attempt budget is spent. Emits a `progress`
 * event per attempt (a simple rising count for the UI), then a terminal
 * `result` / `exhausted` / `error`. Runs off the main thread — a run can be
 * hundreds of exhaustive solves.
 */
self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const {
    difficulty,
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

      const gate = checkGates(board, {
        difficulty,
        corpus: corpusSet,
        batchHashes,
      });
      if (gate.passed) {
        batchHashes.add(boardCanonicalHash(board));
        // Score the winner once for the advisory panel (re-solves the passing
        // board — cheap, happens only on success, not per attempt).
        const result = solveExhaustiveSync(board, { maxDepth: 15 });
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

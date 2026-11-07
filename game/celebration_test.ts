import { assertEquals } from "@std/assert";

import { getCelebrationType } from "#/game/celebration.ts";
import type { PuzzleStats } from "#/game/types.ts";

const puzzle = { minMoves: 6 };

function stats(
  overrides: Partial<PuzzleStats> & { histogram?: Record<number, number> },
): PuzzleStats {
  return {
    totalSolutions: overrides.totalSolutions ?? 0,
    solutionsHistogram: overrides.histogram ?? overrides.solutionsHistogram ??
      {},
    uniqueSolvers: overrides.uniqueSolvers ?? 0,
    hintUsageCount: overrides.hintUsageCount ?? 0,
  };
}

Deno.test("champion: only solve at minMoves", () => {
  const result = getCelebrationType(6, puzzle, {
    puzzleStats: stats({ totalSolutions: 1, histogram: { 6: 1 } }),
    isNewPath: false,
  });
  assertEquals(result, "champion");
});

Deno.test("champion: perfect with no histogram entry yet", () => {
  // edge case — histogram hasn't propagated, perfectsCount is 0 (≤ 1)
  const result = getCelebrationType(6, puzzle, {
    puzzleStats: stats({ totalSolutions: 5, histogram: { 8: 5 } }),
    isNewPath: false,
  });
  assertEquals(result, "champion");
});

Deno.test("pioneer: only solver so far, not perfect", () => {
  const result = getCelebrationType(8, puzzle, {
    puzzleStats: stats({ totalSolutions: 1, histogram: { 8: 1 } }),
    isNewPath: false,
  });
  assertEquals(result, "pioneer");
});

Deno.test("pioneer precedence beats creative when first solver", () => {
  const result = getCelebrationType(8, puzzle, {
    puzzleStats: stats({ totalSolutions: 1, histogram: { 8: 1 } }),
    isNewPath: true,
  });
  assertEquals(result, "pioneer");
});

Deno.test("creative: new path, not perfect, not first solver", () => {
  const result = getCelebrationType(8, puzzle, {
    puzzleStats: stats({ totalSolutions: 5, histogram: { 7: 3, 8: 2 } }),
    isNewPath: true,
  });
  assertEquals(result, "creative");
});

Deno.test("creative: perfect, but others hit it first", () => {
  const result = getCelebrationType(6, puzzle, {
    puzzleStats: stats({ totalSolutions: 10, histogram: { 6: 3, 7: 7 } }),
    isNewPath: true,
  });
  assertEquals(result, "creative");
});

Deno.test("fallback: <10 solves, didn't beat anyone", () => {
  const result = getCelebrationType(9, puzzle, {
    puzzleStats: stats({
      totalSolutions: 5,
      histogram: { 7: 2, 8: 2, 9: 1 }, // user at worst slot
    }),
    isNewPath: false,
  });
  assertEquals(result, "fallback");
});

Deno.test("fallback: <10 solves, beat someone", () => {
  const result = getCelebrationType(8, puzzle, {
    puzzleStats: stats({
      totalSolutions: 5,
      histogram: { 7: 2, 8: 2, 9: 1 }, // beat 1 of 5
    }),
    isNewPath: false,
  });
  assertEquals(result, "fallback");
});

Deno.test("fallback: perfect, others hit it first, same path", () => {
  const result = getCelebrationType(6, puzzle, {
    puzzleStats: stats({ totalSolutions: 10, histogram: { 6: 5, 7: 3, 8: 2 } }),
    isNewPath: false,
  });
  assertEquals(result, "fallback");
});

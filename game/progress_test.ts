import { assertEquals, assertStrictEquals } from "@std/assert";

import {
  decodeProgress,
  encodeProgress,
  getProgress,
  withSolve,
} from "#/game/progress.ts";
import type { Move } from "#/game/types.ts";

// A daily schedule plus the unnumbered onboarding puzzles, like the manifest
function manifest(dailies: number) {
  const numbered = Array.from({ length: dailies }, (_, i) => ({
    slug: `daily-${i + 1}`,
    number: i + 1,
  }));
  const onboarding = ["tutorial", "lars", "lone", "loke"].map((slug) => ({
    slug,
    number: undefined,
  }));
  return [...numbered, ...onboarding];
}

function solves(numbers: number[], moves = 7) {
  return Object.fromEntries(numbers.map((n) => [`daily-${n}`, moves]));
}

function roundTrip(progress: Record<string, number>, entries = manifest(300)) {
  return decodeProgress(encodeProgress(progress, entries), entries);
}

const m: Move = [{ x: 0, y: 0 }, { x: 1, y: 0 }];

function solution(puzzleSlug: string, moveCount: number) {
  return { puzzleSlug, moves: Array.from({ length: moveCount }, () => m) };
}

// getProgress

Deno.test("getProgress() keeps the fewest moves across attempts", () => {
  const solutions = [
    solution("daily-4", 9),
    solution("daily-4", 6),
    solution("daily-4", 8),
    solution("daily-5", 5),
  ];

  assertEquals(getProgress(solutions), { "daily-4": 6, "daily-5": 5 });
});

// withSolve

Deno.test("withSolve() adds a first solve", () => {
  assertEquals(withSolve({ "daily-1": 5 }, "daily-2", 8), {
    "daily-1": 5,
    "daily-2": 8,
  });
});

Deno.test("withSolve() replaces a best score with a better one", () => {
  assertEquals(withSolve({ "daily-1": 9 }, "daily-1", 6), { "daily-1": 6 });
});

Deno.test("withSolve() returns the same progress for a worse score", () => {
  const progress = { "daily-1": 6 };

  assertStrictEquals(withSolve(progress, "daily-1", 9), progress);
});

// encode / decode

Deno.test("decodeProgress() round trips no solves", () => {
  assertEquals(roundTrip({}), {});
});

Deno.test("decodeProgress() round trips dailies with gaps and the reserved puzzles", () => {
  const progress = {
    tutorial: 4,
    lars: 6,
    lone: 9,
    loke: 21,
    "daily-1": 7,
    "daily-2": 12,
    "daily-90": 5,
    "daily-300": 14,
  };

  assertEquals(roundTrip(progress), progress);
});

Deno.test("decodeProgress() resolves against a manifest that gained puzzles", () => {
  const bytes = encodeProgress(solves([1, 2, 40]), manifest(40));

  assertEquals(decodeProgress(bytes, manifest(60)), solves([1, 2, 40]));
});

Deno.test("decodeProgress() skips a number the manifest no longer has", () => {
  const bytes = encodeProgress(solves([1, 2, 40]), manifest(40));

  assertEquals(decodeProgress(bytes, manifest(30)), solves([1, 2]));
});

Deno.test("encodeProgress() drops a slug with no number or reserved slot", () => {
  assertEquals(roundTrip({ "retired-board": 8, "daily-3": 6 }), {
    "daily-3": 6,
  });
});

Deno.test("encodeProgress() takes a byte per puzzle up to the highest solved", () => {
  const bytes = encodeProgress(solves([2_700]), manifest(2_700));

  // Four reserved slots, then one per daily
  assertEquals(bytes.length, 2_704);
});

import { assertEquals } from "@std/assert";

import {
  emptyStarTotals,
  getNewStars,
  getPastStars,
  getSolveStars,
  getStarCount,
  getStarRank,
  withStars,
} from "#/game/stars.ts";
import type { Move } from "#/game/types.ts";

// A 7-move puzzle: perfect is 7.
const puzzle = { minMoves: 7 };

Deno.test("getSolveStars() gives a long solve on a known path just the solve star", () => {
  assertEquals(
    getSolveStars(puzzle, { moves: 11, isNewPath: false, flash: false }),
    ["solve"],
  );
});

Deno.test("getSolveStars() gives a minimum-moves solve perfect on top of solve", () => {
  assertEquals(
    getSolveStars(puzzle, { moves: 7, isNewPath: false, flash: false }),
    ["solve", "perfect"],
  );
});

Deno.test("getSolveStars() gives a long solve on a path no one found first", () => {
  assertEquals(
    getSolveStars(puzzle, { moves: 9, isNewPath: true, flash: false }),
    ["solve", "first"],
  );
});

Deno.test("getSolveStars() gives the first perfect solve of a puzzle all three", () => {
  assertEquals(
    getSolveStars(puzzle, { moves: 7, isNewPath: true, flash: false }),
    ["solve", "perfect", "first"],
  );
});

Deno.test("getSolveStars() gives a Flash solve in minimum moves only Flash", () => {
  assertEquals(
    getSolveStars(puzzle, { moves: 7, isNewPath: false, flash: true }),
    ["flash"],
  );
});

Deno.test("getNewStars() leaves out what a player earned on an earlier solve", () => {
  // Solved before, now back with the first perfect solve.
  assertEquals(
    getNewStars(["solve"], ["solve", "perfect", "first"]),
    ["perfect", "first"],
  );
});

Deno.test("getNewStars() gives a full solve after Flash the solve star", () => {
  assertEquals(getNewStars(["flash"], ["solve"]), ["solve"]);
});

Deno.test("getNewStars() gives a repeat perfect solve nothing", () => {
  assertEquals(
    getNewStars(["solve", "perfect"], ["solve", "perfect"]),
    [],
  );
});

Deno.test("withStars() adds one star per new kind to a player's totals", () => {
  const totals = { solve: 12, perfect: 4, first: 1, flash: 2 };
  assertEquals(
    withStars(totals, ["perfect", "first"]),
    { solve: 12, perfect: 5, first: 2, flash: 2 },
  );
});

Deno.test("getStarCount() counts every kind alike", () => {
  assertEquals(
    getStarCount({ solve: 12, perfect: 4, first: 1, flash: 2 }),
    19,
  );
});

Deno.test("getStarRank() puts a tie on count behind the player with more firsts", () => {
  // Both on 10 stars: one first beats three perfects.
  const ranks = [
    getStarRank({ ...emptyStarTotals, solve: 7, perfect: 3 }),
    getStarRank({ ...emptyStarTotals, solve: 9, first: 1 }),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

  assertEquals(ranks, [[10, 0, 3], [10, 1, 0]]);
});

// Two paths on the board, of 7 and 9 slides.
const slide = (x: number, y: number): Move => [{ x, y }, { x, y: y + 1 }];
const perfectPath = Array.from({ length: 7 }, (_, i) => slide(0, i));
const longPath = Array.from({ length: 9 }, (_, i) => slide(i % 2, i % 7));

Deno.test("getPastStars() gives first to whoever found each path earliest", () => {
  const stars = getPastStars(puzzle, [
    { userId: "ane", moves: longPath },
    { userId: "bo", moves: longPath },
    { userId: "bo", moves: perfectPath },
    { userId: "ane", moves: perfectPath },
    { userId: "cai", moves: perfectPath, flash: true },
  ]);

  assertEquals(Object.fromEntries(stars), {
    ane: ["solve", "first", "perfect"],
    bo: ["solve", "perfect", "first"],
    cai: ["flash"],
  });
});

Deno.test("getPastStars() finds no new path in a Flash solve", () => {
  // Flash went the perfect way first; the later full solve still finds it.
  const stars = getPastStars(puzzle, [
    { userId: "ane", moves: perfectPath, flash: true },
    { userId: "bo", moves: perfectPath },
  ]);

  assertEquals(Object.fromEntries(stars), {
    ane: ["flash"],
    bo: ["solve", "perfect", "first"],
  });
});

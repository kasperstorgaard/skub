import { assertEquals, assertStrictEquals } from "@std/assert";

import {
  decodeScoreKinds,
  emptyUserScore,
  encodeScoreKinds,
  getHighscoreRank,
  getNewScore,
  getPastScore,
  getProgressScore,
  getSolveScore,
  getTotalScore,
  withEarned,
  withFirstSolves,
  withScore,
  withSolutionScore,
} from "#/game/score.ts";
import type { Move } from "#/game/types.ts";

// A 7-move puzzle: perfect is 7.
const puzzle = { minMoves: 7 };

Deno.test("getSolveScore() gives a long solve on a known path just solve", () => {
  assertEquals(
    getSolveScore(puzzle, { moves: 11, isNewPath: false, flash: false }),
    ["solve"],
  );
});

Deno.test("getSolveScore() gives a minimum-moves solve perfect on top of solve", () => {
  assertEquals(
    getSolveScore(puzzle, { moves: 7, isNewPath: false, flash: false }),
    ["solve", "perfect"],
  );
});

Deno.test("getSolveScore() gives a new path two moves past minimum first", () => {
  assertEquals(
    getSolveScore(puzzle, { moves: 9, isNewPath: true, flash: false }),
    ["solve", "first"],
  );
});

Deno.test("getSolveScore() gives a new path three moves past minimum just solve", () => {
  assertEquals(
    getSolveScore(puzzle, { moves: 10, isNewPath: true, flash: false }),
    ["solve"],
  );
});

Deno.test("getSolveScore() gives the first perfect solve of a puzzle all three", () => {
  assertEquals(
    getSolveScore(puzzle, { moves: 7, isNewPath: true, flash: false }),
    ["solve", "perfect", "first"],
  );
});

Deno.test("getSolveScore() gives a Flash solve in minimum moves only Flash", () => {
  assertEquals(
    getSolveScore(puzzle, { moves: 7, isNewPath: false, flash: true }),
    ["flash"],
  );
});

Deno.test("getNewScore() leaves out what a player earned on an earlier solve", () => {
  // Solved before, now back with the first perfect solve.
  assertEquals(
    getNewScore(["solve"], ["solve", "perfect", "first"]),
    ["perfect", "first"],
  );
});

Deno.test("getNewScore() gives a full solve after Flash solve", () => {
  assertEquals(getNewScore(["flash"], ["solve"]), ["solve"]);
});

Deno.test("getNewScore() gives a repeat perfect solve nothing", () => {
  assertEquals(
    getNewScore(["solve", "perfect"], ["solve", "perfect"]),
    [],
  );
});

Deno.test("withScore() adds one point per new kind to a user score", () => {
  const userScore = { solve: 12, perfect: 4, first: 1, flash: 2 };
  assertEquals(
    withScore(userScore, ["solve"], ["solve", "perfect", "first"]),
    { solve: 12, perfect: 5, first: 2, flash: 2 },
  );
});

Deno.test("withScore() moves a Flash point to solve on a full solve", () => {
  const userScore = { solve: 12, perfect: 4, first: 1, flash: 2 };
  assertEquals(
    withScore(userScore, ["flash"], ["solve", "perfect"]),
    { solve: 13, perfect: 5, first: 1, flash: 1 },
  );
});

Deno.test("getNewScore() finds nothing new in a Flash solve after a full one", () => {
  assertEquals(getNewScore(["solve"], ["flash"]), []);
});

Deno.test("withEarned() swaps Flash for solve, keeping three kinds at most", () => {
  assertEquals(
    withEarned(["flash"], ["solve", "perfect", "first"]),
    ["solve", "perfect", "first"],
  );
});

Deno.test("getTotalScore() counts every kind alike", () => {
  assertEquals(
    getTotalScore({ solve: 12, perfect: 4, first: 1, flash: 2 }),
    19,
  );
});

Deno.test("getHighscoreRank() puts a tie on count behind the player with more firsts", () => {
  // Both on 10 points: one first beats three perfects.
  const ranks = [
    getHighscoreRank({ ...emptyUserScore, solve: 7, perfect: 3 }),
    getHighscoreRank({ ...emptyUserScore, solve: 9, first: 1 }),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

  assertEquals(ranks, [[10, 0, 3], [10, 1, 0]]);
});

// An open board with the puck top left and the destination bottom right: two
// slides either way round, or four by going up the right edge and back.
const corner = { minMoves: 2 };
const downRight: Move[] = [
  [{ x: 0, y: 0 }, { x: 0, y: 7 }],
  [{ x: 0, y: 7 }, { x: 7, y: 7 }],
];
const rightDown: Move[] = [
  [{ x: 0, y: 0 }, { x: 7, y: 0 }],
  [{ x: 7, y: 0 }, { x: 7, y: 7 }],
];
const theLongWay: Move[] = [
  ...downRight,
  [{ x: 7, y: 7 }, { x: 7, y: 0 }],
  [{ x: 7, y: 0 }, { x: 7, y: 7 }],
];

Deno.test("withFirstSolves() marks the earliest solve of each path", () => {
  assertEquals(
    withFirstSolves([
      { userId: "ane", moves: theLongWay },
      { userId: "bo", moves: theLongWay },
      { userId: "bo", moves: downRight },
      { userId: "ane", moves: downRight },
      { userId: "ane", moves: rightDown },
    ]),
    [
      { userId: "ane", moves: theLongWay, first: true },
      { userId: "bo", moves: theLongWay },
      { userId: "bo", moves: downRight, first: true },
      { userId: "ane", moves: downRight },
      { userId: "ane", moves: rightDown, first: true },
    ],
  );
});

Deno.test("withFirstSolves() moves a mark wrongly given to a later solve", () => {
  // Two near-simultaneous solves both claimed the path before claims were atomic.
  assertEquals(
    withFirstSolves([
      { userId: "ane", moves: downRight, first: true },
      { userId: "bo", moves: downRight, first: true },
    ]),
    [
      { userId: "ane", moves: downRight, first: true },
      { userId: "bo", moves: downRight },
    ],
  );
});

Deno.test("withFirstSolves() finds no new path in a Flash solve", () => {
  // Flash went down and right first; the later full solve still finds it.
  assertEquals(
    withFirstSolves<{
      userId: string;
      moves: Move[];
      flash?: boolean;
      first?: boolean;
    }>([
      { userId: "ane", moves: downRight, flash: true },
      { userId: "bo", moves: downRight },
    ]),
    [
      { userId: "ane", moves: downRight, flash: true },
      { userId: "bo", moves: downRight, first: true },
    ],
  );
});

Deno.test("getPastScore() gives each player the kinds of their solves", () => {
  const score = getPastScore(corner, [
    { userId: "ane", moves: theLongWay, first: true },
    { userId: "bo", moves: theLongWay },
    { userId: "bo", moves: downRight, first: true },
    { userId: "ane", moves: downRight },
  ]);

  assertEquals(Object.fromEntries(score), {
    ane: ["solve", "perfect", "first"],
    bo: ["solve", "perfect", "first"],
  });
});

Deno.test("getPastScore() turns a Flash solver's star into a solve on a full solve", () => {
  const score = getPastScore(corner, [
    { userId: "ane", moves: downRight, flash: true },
    { userId: "ane", moves: downRight, first: true },
  ]);

  assertEquals(Object.fromEntries(score), {
    ane: ["solve", "perfect", "first"],
  });
});

Deno.test("decodeScoreKinds() reads back every kind but first, in display order", () => {
  assertEquals(
    decodeScoreKinds(encodeScoreKinds(["flash", "perfect", "solve"])),
    ["solve", "perfect", "flash"],
  );
});

Deno.test("withSolutionScore() swaps Flash for a full solve's kinds", () => {
  assertEquals(
    withSolutionScore({ "daily-1": ["flash"] }, "daily-1", ["solve", "first"]),
    { "daily-1": ["solve", "first"] },
  );
});

Deno.test("withSolutionScore() leaves the score as it was for a repeat solve", () => {
  const score = { "daily-1": ["solve" as const, "perfect" as const] };
  assertStrictEquals(
    withSolutionScore(score, "daily-1", ["solve", "perfect"]),
    score,
  );
});

Deno.test("getProgressScore() counts each kind across puzzles", () => {
  assertEquals(
    getProgressScore({
      boxy: ["solve", "perfect"],
      lone: ["solve", "first"],
      loke: ["flash"],
    }),
    { solve: 2, perfect: 1, first: 1, flash: 1 },
  );
});

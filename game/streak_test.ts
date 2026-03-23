import { assertEquals } from "@std/assert";

import { computeUserStats } from "#/game/streak.ts";
import { Move } from "#/game/types.ts";

// Helpers — entries are newest-first (index 0 = today)
function entry(slug: string, minMoves = 3) {
  return { slug, minMoves };
}

// A dummy move pair — the specific positions don't matter for streak logic
const m: Move = [{ x: 0, y: 0 }, { x: 1, y: 0 }];

function solution(puzzleSlug: string, moveCount: number) {
  return { puzzleSlug, moves: Array.from({ length: moveCount }, () => m) };
}

// currentStreak

Deno.test("currentStreak — consecutive solves from today", () => {
  const entries = [entry("c"), entry("b"), entry("a")];
  const solutions = [solution("c", 3), solution("b", 4), solution("a", 5)];

  assertEquals(computeUserStats(entries, solutions).currentStreak, 3);
});

Deno.test("currentStreak — skips today if unsolved, counts from yesterday", () => {
  const entries = [entry("c"), entry("b"), entry("a")];
  const solutions = [solution("b", 4), solution("a", 5)];

  assertEquals(computeUserStats(entries, solutions).currentStreak, 2);
});

Deno.test("currentStreak — gap in the middle breaks the streak", () => {
  const entries = [entry("d"), entry("c"), entry("b"), entry("a")];
  const solutions = [solution("d", 3), solution("b", 4), solution("a", 5)];

  assertEquals(computeUserStats(entries, solutions).currentStreak, 1);
});

Deno.test("currentStreak — no solves returns 0", () => {
  const entries = [entry("b"), entry("a")];

  assertEquals(computeUserStats(entries, []).currentStreak, 0);
});

Deno.test("currentStreak — no entries returns 0", () => {
  assertEquals(computeUserStats([], [solution("a", 3)]).currentStreak, 0);
});

// bestStreak

Deno.test("bestStreak — tracks longest consecutive run across full history", () => {
  // Pattern: solved, solved, solved, gap, solved, solved
  const entries = [
    entry("f"),
    entry("e"),
    entry("d"),
    entry("c"),
    entry("b"),
    entry("a"),
  ];
  const solutions = [
    solution("f", 3),
    solution("e", 3),
    solution("b", 3),
    solution("a", 3),
    solution("d", 3),
  ];

  assertEquals(computeUserStats(entries, solutions).bestStreak, 3);
});

Deno.test("bestStreak — single solve counts as 1", () => {
  const entries = [entry("c"), entry("b"), entry("a")];
  const solutions = [solution("b", 4)];

  assertEquals(computeUserStats(entries, solutions).bestStreak, 1);
});

Deno.test("bestStreak — current streak can equal best streak", () => {
  const entries = [entry("d"), entry("c"), entry("b"), entry("a")];
  const solutions = [
    solution("d", 3),
    solution("c", 3),
    solution("a", 3),
  ];

  // Current streak is 2 (d, c), best is also 2
  const stats = computeUserStats(entries, solutions);
  assertEquals(stats.currentStreak, 2);
  assertEquals(stats.bestStreak, 2);
});

// totalSolves

Deno.test("totalSolves — counts unique puzzles, not total solutions", () => {
  const entries = [entry("b"), entry("a")];
  // Two solutions for the same puzzle
  const solutions = [solution("a", 3), solution("a", 5)];

  assertEquals(computeUserStats(entries, solutions).totalSolves, 1);
});

// optimalSolves

Deno.test("optimalSolves — counts puzzles solved in minMoves", () => {
  const entries = [entry("c", 3), entry("b", 4), entry("a", 5)];
  const solutions = [
    solution("c", 3), // optimal
    solution("b", 6), // not optimal
    solution("a", 5), // optimal
  ];

  assertEquals(computeUserStats(entries, solutions).optimalSolves, 2);
});

Deno.test("optimalSolves — counts puzzle as optimal if any attempt matches", () => {
  const entries = [entry("a", 3)];
  const solutions = [
    solution("a", 5), // not optimal
    solution("a", 3), // optimal
  ];

  assertEquals(computeUserStats(entries, solutions).optimalSolves, 1);
});

Deno.test("optimalSolves — ignores solutions for puzzles not in entries", () => {
  const entries = [entry("a", 3)];
  const solutions = [solution("unknown", 3)];

  assertEquals(computeUserStats(entries, solutions).optimalSolves, 0);
});

// Full scenario

Deno.test("full scenario — realistic 5-day history with mixed solves", () => {
  // Day 1 (oldest) through 5 (today), entries newest-first
  const entries = [
    entry("day5", 4),
    entry("day4", 3),
    entry("day3", 5),
    entry("day2", 3),
    entry("day1", 6),
  ];

  const solutions = [
    solution("day5", 4), // today, optimal
    solution("day4", 3), // optimal
    solution("day3", 7), // not optimal
    // day2: skipped
    solution("day1", 6), // optimal
  ];

  const stats = computeUserStats(entries, solutions);

  assertEquals(stats, {
    currentStreak: 3, // day5, day4, day3 — consecutive from today
    bestStreak: 3, // same run
    totalSolves: 4, // 4 unique puzzles
    optimalSolves: 3, // day5, day4, day1
  });
});

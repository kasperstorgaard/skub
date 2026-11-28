import { assertEquals } from "@std/assert";

import { pickRecommendedSlug } from "#/game/recommendation.ts";
import type { Difficulty } from "#/game/types.ts";

// Onboarding puzzles live only in the manifest, the dailies in both lists.
const manifest = [
  { slug: "tutorial", onboardingLevel: 1 },
  { slug: "lars", onboardingLevel: 2 },
  { slug: "lone", onboardingLevel: 3 },
  { slug: "loke" },
];

function daily(slug: string, difficulty: Difficulty, isFuture = false) {
  return { slug, minMoves: 8, difficulty, isFuture };
}

const entries = [
  daily("today", "easy"),
  daily("yesterday", "medium"),
  daily("last-week", "hard"),
  daily("last-month", "ultra"),
  daily("tomorrow", "easy", true),
];

// Always picks the first candidate
const pool = { manifest, entries, dailySlug: "today", random: () => 0 };

Deno.test("pickRecommendedSlug() gives a new player the tutorial", () => {
  assertEquals(pickRecommendedSlug({ skillLevel: null }, {}, pool), "tutorial");
});

Deno.test("pickRecommendedSlug() gives a beginner the first onboarding puzzle", () => {
  assertEquals(
    pickRecommendedSlug({ skillLevel: "beginner" }, {}, pool),
    "lars",
  );
});

Deno.test("pickRecommendedSlug() gives a beginner the next unsolved onboarding puzzle", () => {
  const bestMoves = { lars: 6 };

  assertEquals(
    pickRecommendedSlug({ skillLevel: "beginner" }, bestMoves, pool),
    "lone",
  );
});

Deno.test("pickRecommendedSlug() keeps a beginner on the last onboarding puzzle once all are solved", () => {
  const bestMoves = { lars: 6, lone: 9 };

  assertEquals(
    pickRecommendedSlug({ skillLevel: "beginner" }, bestMoves, pool),
    "lone",
  );
});

Deno.test("pickRecommendedSlug() gives an intermediate player an unplayed easy or medium puzzle", () => {
  const bestMoves = { "last-week": 8 };

  assertEquals(
    pickRecommendedSlug({ skillLevel: "intermediate" }, bestMoves, pool),
    "yesterday",
  );
});

Deno.test("pickRecommendedSlug() gives an expert an unplayed hard puzzle", () => {
  const bestMoves = { "yesterday": 9 };

  assertEquals(
    pickRecommendedSlug({ skillLevel: "expert" }, bestMoves, pool),
    "last-week",
  );
});

Deno.test("pickRecommendedSlug() never gives the daily, even when it's the only one unplayed", () => {
  const bestMoves = { "yesterday": 9, "last-week": 10, "last-month": 8 };

  // Everything is played, so it falls back to the non-optimal ones
  assertEquals(
    pickRecommendedSlug({ skillLevel: "expert" }, bestMoves, pool),
    "yesterday",
  );
});

Deno.test("pickRecommendedSlug() gives a non-optimal puzzle once all are played", () => {
  const bestMoves = {
    today: 8,
    "yesterday": 8,
    "last-week": 11,
    "last-month": 8,
  };

  assertEquals(
    pickRecommendedSlug({ skillLevel: "expert" }, bestMoves, pool),
    "last-week",
  );
});

Deno.test("pickRecommendedSlug() gives loke once everything released is perfected", () => {
  const bestMoves = { "yesterday": 8, "last-week": 8, "last-month": 8 };

  assertEquals(
    pickRecommendedSlug({ skillLevel: "expert" }, bestMoves, pool),
    "loke",
  );
});

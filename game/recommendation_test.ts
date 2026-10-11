import { assertEquals } from "@std/assert";

import {
  getAvailableEntries,
  getPuzzleManifest,
  getTodaysPuzzle,
} from "#/game/loader.ts";
import type { Progress } from "#/game/progress.ts";
import { pickRecommendedPuzzle } from "#/game/recommendation.ts";

// Best moves of every released daily, optimal or one over
async function releasedProgress(options: { optimal: boolean }) {
  const entries = await getAvailableEntries();
  const released = entries.filter((e) => !e.isFuture && e.minMoves);
  const extra = options.optimal ? 0 : 1;

  return Object.fromEntries(
    released.map((e) => [e.slug, (e.minMoves ?? 0) + extra]),
  ) as Progress;
}

// A released daily an expert can be recommended: not today's, not ultra
async function recommendableSlug() {
  const [entries, daily] = await Promise.all([
    getAvailableEntries(),
    getTodaysPuzzle(),
  ]);
  const entry = entries.find((e) =>
    !e.isFuture && e.minMoves && e.difficulty !== "ultra" &&
    e.slug !== daily?.slug
  );
  if (!entry) throw new Error("Needs a recommendable released puzzle");
  return entry.slug;
}

async function onboardingSlugs() {
  const manifest = await getPuzzleManifest();
  return manifest
    .filter((e) => (e.onboardingLevel ?? 0) > 1)
    .sort((a, b) => (a.onboardingLevel ?? 0) - (b.onboardingLevel ?? 0))
    .map((e) => e.slug);
}

Deno.test("pickRecommendedPuzzle() gives a new player the tutorial", async () => {
  const puzzle = await pickRecommendedPuzzle({ skillLevel: null }, {});

  assertEquals(puzzle.onboardingLevel, 1);
});

Deno.test("pickRecommendedPuzzle() gives a beginner the first onboarding puzzle", async () => {
  const [first] = await onboardingSlugs();
  const puzzle = await pickRecommendedPuzzle({ skillLevel: "beginner" }, {});

  assertEquals(puzzle.slug, first);
});

Deno.test("pickRecommendedPuzzle() gives a beginner the next unsolved onboarding puzzle", async () => {
  const [first, second] = await onboardingSlugs();
  const puzzle = await pickRecommendedPuzzle(
    { skillLevel: "beginner" },
    { [first]: 6 },
  );

  assertEquals(puzzle.slug, second);
});

Deno.test("pickRecommendedPuzzle() keeps a beginner on the last onboarding puzzle once all are solved", async () => {
  const slugs = await onboardingSlugs();
  const progress = Object.fromEntries(slugs.map((slug) => [slug, 6]));
  const puzzle = await pickRecommendedPuzzle(
    { skillLevel: "beginner" },
    progress,
  );

  assertEquals(puzzle.slug, slugs.at(-1));
});

Deno.test("pickRecommendedPuzzle() gives loke once everything is perfected", async () => {
  const progress = await releasedProgress({ optimal: true });
  const puzzle = await pickRecommendedPuzzle(
    { skillLevel: "expert" },
    progress,
  );

  assertEquals(puzzle.slug, "loke");
});

Deno.test("pickRecommendedPuzzle() gives the one unplayed puzzle, never the daily", async () => {
  const daily = await getTodaysPuzzle();
  const unplayed = await recommendableSlug();
  const progress = await releasedProgress({ optimal: true });
  delete progress[unplayed];
  if (daily) delete progress[daily.slug];

  const puzzle = await pickRecommendedPuzzle(
    { skillLevel: "expert" },
    progress,
  );

  assertEquals(puzzle.slug, unplayed);
});

Deno.test("pickRecommendedPuzzle() gives a suboptimal puzzle once all are played", async () => {
  const suboptimal = await recommendableSlug();
  const progress = await releasedProgress({ optimal: true });
  progress[suboptimal] += 1;

  const puzzle = await pickRecommendedPuzzle(
    { skillLevel: "expert" },
    progress,
  );

  assertEquals(puzzle.slug, suboptimal);
});

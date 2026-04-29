import { getBestMoves } from "#/db/solutions.ts";
import type { Solution } from "#/db/types.ts";
import {
  getAvailableEntries,
  getLatestPuzzle,
  getOnboardingPuzzle,
  getPuzzle,
  getRandomPuzzle,
  getTutorialPuzzle,
} from "#/game/loader.ts";
import type { SkillLevel } from "#/game/types.ts";

/**
 * Picks the puzzle to recommend to the user — the "what should I play next"
 * answer shared between the home page card and the `/puzzles/random` redirect:
 *
 *  - new user (`skillLevel === null`) → tutorial puzzle (kind: "onboarding")
 *  - beginner with remaining onboarding → onboarding puzzle (kind: "onboarding")
 *  - beginner who exhausted onboarding → falls through to random
 *  - everything perfected → "loke" (the endgame puzzle, kind: "random")
 *  - otherwise → random non-optimal puzzle of appropriate difficulty,
 *    with today's daily excluded (kind: "random")
 */
export async function pickRecommendedPuzzle(
  user: { skillLevel: SkillLevel | null },
  solutions: Solution[],
) {
  if (user.skillLevel === null) {
    const puzzle = await getTutorialPuzzle();
    if (!puzzle) throw new Error("Unable to get tutorial puzzle");
    return puzzle;
  }

  if (user.skillLevel === "beginner") {
    const solvedSlugs = solutions.map((s) => s.puzzleSlug);
    const puzzle = await getOnboardingPuzzle({ excludeSlugs: solvedSlugs });
    if (!puzzle) throw new Error("Unable to get onboarding puzzle");
    return puzzle;
  }

  const bestMoves = getBestMoves(solutions);
  const entries = await getAvailableEntries();
  const optimalSlugs = entries
    .filter((entry) => bestMoves[entry.slug] === entry.minMoves)
    .map((entry) => entry.slug);
  const allPerfected = entries
    .filter((entry) => entry.minMoves)
    .every((entry) => optimalSlugs.includes(entry.slug));

  if (allPerfected) {
    const puzzle = await getPuzzle("loke");
    if (!puzzle) throw new Error("Unable to get final puzzle");
    return puzzle;
  }

  const dailyPuzzle = await getLatestPuzzle();
  const excludeSlugs = [
    ...(dailyPuzzle ? [dailyPuzzle.slug] : []),
    ...optimalSlugs,
  ];

  const puzzle = await getRandomPuzzle({
    excludeSlugs,
    difficulty: user.skillLevel === "expert"
      ? ["easy", "medium", "hard"]
      : ["easy", "medium"],
  });

  if (!puzzle) throw new Error("Unable to get random puzzle");
  return puzzle;
}

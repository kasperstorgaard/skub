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
 * answer shared between the home page card and the `/puzzles/recommended` redirect:
 *
 *  - new user (`skillLevel === null`) → tutorial puzzle (kind: "onboarding")
 *  - beginner with remaining onboarding → onboarding puzzle (kind: "onboarding")
 *  - beginner who exhausted onboarding → falls through to random
 *  - everything perfected (or only today's daily left) → "loke" (kind: "random")
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
  const [entries, dailyPuzzle] = await Promise.all([
    getAvailableEntries(),
    getLatestPuzzle(),
  ]);
  const optimalSlugs = entries
    .filter((entry) => bestMoves[entry.slug] === entry.minMoves)
    .map((entry) => entry.slug);

  // Endgame: everything available (besides today's daily, which is shown on its
  // own card) is perfected. Recommend loke even if today's daily is still
  // unsolved — otherwise excludeSlugs covers every puzzle and we 500.
  const nothingLeftToPerfect = entries
    .filter((entry) => entry.minMoves && entry.slug !== dailyPuzzle?.slug)
    .every((entry) => optimalSlugs.includes(entry.slug));

  if (nothingLeftToPerfect) {
    const puzzle = await getPuzzle("loke");
    if (!puzzle) throw new Error("Unable to get final puzzle");
    return puzzle;
  }

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

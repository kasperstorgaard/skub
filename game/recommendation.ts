import {
  type AvailableEntry,
  getAvailableEntries,
  getPuzzle,
  getPuzzleManifest,
  getTodaysPuzzle,
} from "#/game/loader.ts";
import type { Progress } from "#/game/progress.ts";
import type {
  Difficulty,
  PuzzleManifestEntry,
  SkillLevel,
} from "#/game/types.ts";

type RecommendationPool = {
  manifest: Pick<PuzzleManifestEntry, "slug" | "onboardingLevel">[];
  entries: Pick<
    AvailableEntry,
    "slug" | "minMoves" | "difficulty" | "isFuture"
  >[];
  dailySlug?: string;
  // Returns [0, 1), like Math.random
  random?: () => number;
};

/**
 * Picks the puzzle to recommend to the user — the "what should I play next"
 * answer shared between the home page card and the `/puzzles/recommended`
 * redirect. See {@link pickRecommendedSlug} for the rules.
 */
export async function pickRecommendedPuzzle(
  user: { skillLevel: SkillLevel | null },
  bestMoves: Progress,
) {
  const [manifest, entries, daily] = await Promise.all([
    getPuzzleManifest(),
    getAvailableEntries(),
    getTodaysPuzzle(),
  ]);

  const slug = pickRecommendedSlug(user, bestMoves, {
    manifest,
    entries,
    dailySlug: daily?.slug,
  });

  const puzzle = await getPuzzle(slug);
  if (!puzzle) throw new Error(`Unable to get recommended puzzle: ${slug}`);
  return puzzle;
}

/**
 * The slug to recommend:
 *
 *  - new user (`skillLevel === null`) → the tutorial
 *  - beginner → the first unsolved onboarding puzzle, else the last one
 *  - everything perfected (or only today's daily left) → "loke"
 *  - otherwise → a random unplayed puzzle of appropriate difficulty, else a
 *    random non-optimal one, never today's daily
 */
export function pickRecommendedSlug(
  user: { skillLevel: SkillLevel | null },
  bestMoves: Progress,
  pool: RecommendationPool,
): string {
  const { manifest, entries, dailySlug, random = Math.random } = pool;

  if (user.skillLevel === null) {
    const tutorial = manifest.find((entry) => entry.onboardingLevel === 1);
    if (!tutorial) throw new Error("Unable to get tutorial puzzle");
    return tutorial.slug;
  }

  if (user.skillLevel === "beginner") {
    const onboarding = manifest
      .filter((entry) => (entry.onboardingLevel ?? 0) > 1)
      .sort((a, b) => (a.onboardingLevel ?? 0) - (b.onboardingLevel ?? 0));
    const next = onboarding.find((entry) => !(entry.slug in bestMoves)) ??
      onboarding.at(-1);
    if (!next) throw new Error("Unable to get onboarding puzzle");
    return next.slug;
  }

  // Only released boards count. Locally the available list carries the whole
  // schedule, and a puzzle nobody could have played is neither perfected nor
  // worth recommending.
  const released = entries.filter((entry) => !entry.isFuture);

  const playedSlugs = released
    .filter((entry) => bestMoves[entry.slug])
    .map((entry) => entry.slug);

  const optimalSlugs = released
    .filter((entry) => bestMoves[entry.slug] === entry.minMoves)
    .map((entry) => entry.slug);

  // Endgame: everything available (besides today's daily, which is shown on its
  // own card) is perfected. Recommend loke even if today's daily is still
  // unsolved — otherwise every puzzle is excluded and we 500.
  const nothingLeftToPerfect = released
    .filter((entry) => entry.minMoves && entry.slug !== dailySlug)
    .every((entry) => optimalSlugs.includes(entry.slug));

  if (nothingLeftToPerfect) return "loke";

  const difficulty: Difficulty[] = user.skillLevel === "expert"
    ? ["easy", "medium", "hard"]
    : ["easy", "medium"];

  const pick = (excludeSlugs: string[]) => {
    const candidates = released
      .filter((entry) => difficulty.includes(entry.difficulty))
      .filter((entry) => entry.slug !== dailySlug)
      .filter((entry) => !excludeSlugs.includes(entry.slug));
    return candidates[Math.floor(random() * candidates.length)]?.slug;
  };

  const slug = pick(playedSlugs) ?? pick(optimalSlugs);
  if (!slug) throw new Error("Unable to get random puzzle");
  return slug;
}

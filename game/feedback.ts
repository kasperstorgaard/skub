/** How hard a rated puzzle felt. */
export type Difficulty = "easy" | "right" | "hard";

export const DIFFICULTIES: Difficulty[] = ["easy", "right", "hard"];

/** A player's rating of a puzzle: every part optional but at least one given. */
export type Rating = {
  difficulty?: Difficulty;
  liked?: boolean;
};

/**
 * Where the feedback came from, so prompted ratings can be told apart from
 * ones players went looking to give: `prompted` is Rate in the celebration's
 * action slot, `nudge` the solutions page's ask, `celebration` the
 * celebration's always-there icon, `panel` the sidebar link.
 */
export type FeedbackSource = "prompted" | "nudge" | "celebration" | "panel";

export const FEEDBACK_SOURCES: FeedbackSource[] = [
  "prompted",
  "nudge",
  "celebration",
  "panel",
];

// The first solve is still onboarding: "Play one more" keeps its slot there.
// The second always asks, to catch a first impression.
const FIRST_ASK = 2;
// After that, about one in this many unrated puzzles.
const ASK_EVERY = 3;

type AskOptions = {
  userId: string;
  /** Puzzles solved, counting this one. */
  solvedCount: number;
  /** The player has already rated this puzzle. */
  isRated: boolean;
};

/**
 * Whether the celebration offers Rate in place of "Play one more". Picked per
 * player and puzzle rather than at random, so a reload never flips it: never
 * on a first solve, always on the second, then about one in three — never on a
 * puzzle already rated. The celebration's rate icon is there either way.
 */
export function shouldAskRating(slug: string, options: AskOptions): boolean {
  const { userId, solvedCount, isRated } = options;

  if (isRated || solvedCount < FIRST_ASK) return false;
  if (solvedCount === FIRST_ASK) return true;

  return hash(`${userId}:${slug}`) % ASK_EVERY === 0;
}

/** Reads a rating from a submitted form; undefined when nothing was picked. */
export function parseRating(form: FormData): Rating | undefined {
  const difficulty = form.get("difficulty")?.toString();
  const liked = form.get("liked")?.toString();

  const rating: Rating = {};
  if (DIFFICULTIES.includes(difficulty as Difficulty)) {
    rating.difficulty = difficulty as Difficulty;
  }
  if (liked === "yes" || liked === "no") rating.liked = liked === "yes";

  return Object.keys(rating).length > 0 ? rating : undefined;
}

/** FNV-1a: small, stable and spread evenly enough to pick one in three. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

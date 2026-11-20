/**
 * What the celebration's second call to action offers, beside See solutions:
 * another puzzle, a rating, or building your own.
 */
export type CelebrationAction = "play" | "rate" | "build";

// The first solve is still onboarding: Play one more. The second asks for a
// rating, to catch a first impression.
const FIRST_SOLVE = 1;
const FIRST_RATE = 2;
const ROTATION: CelebrationAction[] = ["rate", "build", "play"];

type ActionOptions = {
  userId: string;
  /** Puzzles solved, counting this one. */
  solvedCount: number;
  /** The player has already rated this puzzle. */
  isRated: boolean;
};

/**
 * Picks the celebration's second action. Per player and puzzle rather than at
 * random, so a reload never flips it and the server can render it: Play one
 * more on a first solve, Rate on the second, then a third each of Rate, Build
 * and Play — Play where the puzzle is already rated. The rate icon is there
 * either way.
 */
export function pickCelebrationAction(
  slug: string,
  options: ActionOptions,
): CelebrationAction {
  const { userId, solvedCount, isRated } = options;

  if (solvedCount <= FIRST_SOLVE) return "play";
  if (solvedCount === FIRST_RATE) return isRated ? "play" : "rate";

  const action = ROTATION[hash(`${userId}:${slug}`) % ROTATION.length];
  return action === "rate" && isRated ? "play" : action;
}

/** FNV-1a: small, stable and spread evenly enough for the rotation. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

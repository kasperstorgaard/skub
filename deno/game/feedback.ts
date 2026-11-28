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

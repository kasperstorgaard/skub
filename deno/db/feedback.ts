import { ulid } from "@std/ulid";

import { kv } from "#/db/kv.ts";
import type { FeedbackSource, Rating } from "#/game/feedback.ts";

/** One piece of feedback as sent: a rating, a message, or both. */
export type Feedback = Rating & {
  id: string;
  userId: string;
  /** Unset for feedback on the game rather than a puzzle. */
  puzzleSlug?: string;
  message?: string;
  source: FeedbackSource;
  createdAt: Date;
};

/**
 * Feedback lives in two places:
 * - every piece, by id, in the order it came in
 * - a player's latest rating per puzzle, so the celebration knows what's been
 *   rated and calibration can read one rating per player
 */
const feedbackKey = (id: string) => ["feedback", id];
const ratingKey = (userId: string, puzzleSlug: string) => [
  "rating_by_user_puzzle",
  userId,
  puzzleSlug,
];

export async function saveFeedback(
  feedback: Omit<Feedback, "id" | "createdAt">,
): Promise<Feedback> {
  const saved: Feedback = {
    ...feedback,
    id: ulid().toLowerCase(),
    createdAt: new Date(),
  };

  const op = kv.atomic().set(feedbackKey(saved.id), saved);
  const isRating = saved.difficulty !== undefined || saved.liked !== undefined;
  if (saved.puzzleSlug && isRating) {
    op.set(ratingKey(saved.userId, saved.puzzleSlug), saved);
  }
  await op.commit();

  return saved;
}

/** Slugs of the puzzles a player has rated. */
export async function listRatedPuzzles(userId: string): Promise<string[]> {
  const slugs: string[] = [];
  const iter = kv.list({ prefix: ["rating_by_user_puzzle", userId] });
  for await (const entry of iter) slugs.push(entry.key[2] as string);
  return slugs;
}

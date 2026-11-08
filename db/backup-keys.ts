/** Every prefix the app writes, but `user`: backed up whole. */
export const backupPrefixes = [
  "auth",
  "auth_session",
  "highscore",
  "oauth_state",
  "solution_groups_by_puzzle",
  "solution_score_by_user_puzzle",
  "solutions_by_puzzle",
  "solutions_by_puzzle_canonical",
  "solutions_by_user",
  "solutions_by_user_puzzle",
  "user_score",
];

/**
 * Read per player instead: old bot rows make the whole prefix too big to
 * scan. Backed up whole once hosting moves and leaves them behind.
 */
export const perPlayerPrefixes = ["user"];

/**
 * The player an entry belongs to: whoever has a solution or a login. Read
 * from those, so the bot-heavy `user` prefix is never scanned.
 */
export function getPlayerId(
  entry: Pick<Deno.KvEntry<unknown>, "key" | "value">,
): string | undefined {
  const { key, value } = entry;
  if (key[0] === "solutions_by_user") return String(key[1]);
  if (key[0] === "auth" && key[2] === "userId") return String(value);
}

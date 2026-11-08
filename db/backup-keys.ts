/**
 * Prefixes backed up whole: each solution under its four keys, the paths the
 * solutions page lists, and logins.
 */
export const backupPrefixes = [
  "solutions_by_puzzle",
  "solutions_by_puzzle_canonical",
  "solutions_by_user",
  "solutions_by_user_puzzle",
  "solution_groups_by_puzzle",
  "auth",
];

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

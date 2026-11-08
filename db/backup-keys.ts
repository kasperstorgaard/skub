/** Prefixes only players write: each solution under its four keys, and logins. */
export const playerPrefixes = [
  "solutions_by_puzzle",
  "solutions_by_puzzle_canonical",
  "solutions_by_user",
  "solutions_by_user_puzzle",
  "auth",
];

/**
 * Everyone with a solution or a login, read from those prefixes' entries, so
 * the bot-heavy `user` prefix is never scanned.
 */
export function getPlayerIds(
  entries: Pick<Deno.KvEntry<unknown>, "key" | "value">[],
): string[] {
  const userIds = new Set<string>();
  for (const { key, value } of entries) {
    if (key[0] === "solutions_by_user") userIds.add(String(key[1]));
    if (key[0] === "auth" && key[2] === "userId") userIds.add(String(value));
  }
  return [...userIds];
}

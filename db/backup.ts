import { getPlayerIds, playerPrefixes } from "#/db/backup-keys.ts";
import { rawKv } from "#/db/kv.ts";
import { encodeEntry } from "#/lib/kv-json.ts";

// getMany takes at most 10 keys.
const getManySize = 10;

/** Every player's data as JSON Lines, in restore-kv.ts's format. */
export async function getPlayersBackup() {
  const seen: Pick<Deno.KvEntry<unknown>, "key" | "value">[] = [];

  // Independent prefixes, so they're read at once.
  const prefixLines = await Promise.all(
    playerPrefixes.map(async (prefix) => {
      const lines: string[] = [];
      const entries = rawKv.list({ prefix: [prefix] }, { batchSize: 500 });
      for await (const entry of entries) {
        lines.push(JSON.stringify(encodeEntry(entry)));
        if (prefix === "solutions_by_user") {
          seen.push({ key: entry.key, value: null });
        }
        if (prefix === "auth") seen.push(entry);
      }
      return lines;
    }),
  );
  const lines = prefixLines.flat();

  const playerIds = getPlayerIds(seen);
  const userKeys = playerIds.flatMap((id) => [
    ["user", id],
    ["user", id, "puzzle_draft"],
  ]);
  for (let i = 0; i < userKeys.length; i += getManySize) {
    const entries = await rawKv.getMany(userKeys.slice(i, i + getManySize));
    for (const entry of entries) {
      if (entry.versionstamp === null) continue;
      lines.push(JSON.stringify(encodeEntry(entry)));
    }
  }

  return {
    body: lines.join("\n") + "\n",
    players: playerIds.length,
    entries: lines.length,
  };
}

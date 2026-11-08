import { getPlayerIds, playerPrefixes } from "#/db/backup-keys.ts";
import { rawKv } from "#/db/kv.ts";
import { encodeEntry } from "#/lib/kv-json.ts";
import { withSpan } from "#/lib/tracing.ts";

const bucket = "skub-kv-backups";

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

/**
 * Uploads every player's data to the backup bucket, named by the hour. Runs
 * only where the GCP cloud connection is (production).
 */
export function backupPlayers() {
  if (!Deno.env.has("GCP_SERVICE_ACCOUNT_EMAIL")) return;

  return withSpan("backup.players", async (span) => {
    const { body, players, entries } = await getPlayersBackup();
    const name = `players/${new Date().toISOString().slice(0, 13)}.jsonl`;

    // Loaded here, so the SDK stays out of every request's cold start.
    const { Storage } = await import("@google-cloud/storage");
    await new Storage().bucket(bucket).file(name).save(body, {
      contentType: "application/x-ndjson",
      resumable: false,
    });

    span.setAttribute("players.count", players);
    span.setAttribute("entries.count", entries);
    span.setAttribute("backup.bytes", body.length);
  });
}

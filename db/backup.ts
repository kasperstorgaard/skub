import { backupPrefixes, getPlayerId } from "#/db/backup-keys.ts";
import { rawKv } from "#/db/kv.ts";
import { encodeEntry } from "#/lib/kv-json.ts";
import { withSpan } from "#/lib/tracing.ts";

const bucket = "skub-kv-backups";

// getMany takes at most 10 keys.
const getManySize = 10;
const getManyAtOnce = 10;

/** Every player's data as JSON Lines, in restore-kv.ts's format. */
export async function getPlayersBackup() {
  const playerIds = new Set<string>();

  // Independent prefixes, so they're read at once.
  const prefixLines = await Promise.all(
    backupPrefixes.map(async (prefix) => {
      const lines: string[] = [];
      const entries = rawKv.list({ prefix: [prefix] }, { batchSize: 500 });
      for await (const entry of entries) {
        lines.push(JSON.stringify(encodeEntry(entry)));
        const playerId = getPlayerId(entry);
        if (playerId) playerIds.add(playerId);
      }
      return lines;
    }),
  );
  const lines = prefixLines.flat();

  const userKeys = [...playerIds].flatMap((id) => [
    ["user", id],
    ["user", id, "puzzle_draft"],
  ]);
  const batches: Deno.KvKey[][] = [];
  for (let i = 0; i < userKeys.length; i += getManySize) {
    batches.push(userKeys.slice(i, i + getManySize));
  }
  for (let i = 0; i < batches.length; i += getManyAtOnce) {
    const results = await Promise.all(
      batches.slice(i, i + getManyAtOnce).map((keys) => rawKv.getMany(keys)),
    );
    for (const entry of results.flat()) {
      if (entry.versionstamp === null) continue;
      lines.push(JSON.stringify(encodeEntry(entry)));
    }
  }

  return {
    body: lines.join("\n") + "\n",
    players: playerIds.size,
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

    // Loaded here, so the SDK stays out of every request's cold start, and
    // by Deno, not bundled: its CommonJS dependencies break in the bundle.
    const sdk = "@google-cloud/storage";
    const { Storage }: typeof import("@google-cloud/storage") = await import(
      /* @vite-ignore */ sdk
    );
    await new Storage().bucket(bucket).file(name).save(body, {
      contentType: "application/x-ndjson",
      resumable: false,
    });

    span.setAttribute("players.count", players);
    span.setAttribute("entries.count", entries);
    span.setAttribute("backup.bytes", new TextEncoder().encode(body).length);
  });
}

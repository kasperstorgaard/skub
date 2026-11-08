/**
 * Writes every player's data to a file, the same as the hourly backup cron
 * uploads. Restore with ./scripts/restore-kv.ts.
 *
 * deno run -A ./scripts/backup-kv.ts <file>
 *
 * Against a hosted database, over KV Connect (needs a recent Deno: older ones
 * can't read values Deploy wrote):
 * SKUB_KV_URL=https://api.deno.com/v2/databases/<id>/connect \
 * DENO_KV_ACCESS_TOKEN=ddo_... deno run -A ./scripts/backup-kv.ts <file>
 */
import { getPlayersBackup } from "#/db/backup.ts";

const [path] = Deno.args;
if (!path) throw new Error("Usage: backup-kv.ts <file>");

const { body, players, entries } = await getPlayersBackup();
await Deno.writeTextFile(path, body, { createNew: true });

console.log(`Backed up ${players} players, ${entries} entries, to ${path}`);

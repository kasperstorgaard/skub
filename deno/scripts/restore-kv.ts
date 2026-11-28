/**
 * Writes every entry in a backup file into KV, over what's there. Entries not
 * in the file are left alone.
 *
 * gcloud storage cp gs://skub-kv-backups/players/<hour>.jsonl .
 * deno run -A ./scripts/restore-kv.ts <file> --confirm
 *
 * Against a hosted database, set SKUB_KV_URL and DENO_KV_ACCESS_TOKEN as for
 * ./scripts/backup-kv.ts.
 */
import { kv } from "#/db/kv.ts";
import { decodeEntry } from "#/lib/kv-json.ts";

// Entries per atomic commit, well under KV's mutation limit.
const commitSize = 100;

const [path] = Deno.args;
if (!path) throw new Error("Usage: restore-kv.ts <file> --confirm");
if (!Deno.args.includes("--confirm")) {
  throw new Error("Writes over live data: pass --confirm");
}

const entries = (await Deno.readTextFile(path))
  .split("\n")
  .filter(Boolean)
  .map((line) => decodeEntry(JSON.parse(line)));

for (let i = 0; i < entries.length; i += commitSize) {
  const atomic = kv.atomic();
  for (const { key, value } of entries.slice(i, i + commitSize)) {
    atomic.set(key, value);
  }
  await atomic.commit();
}

console.log(`Restored ${entries.length} entries from ${path}`);

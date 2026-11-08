# Players' data is backed up every hour

Production KV has no backup. The new Deno Deploy has no built-in one (the
continuous S3 backup in the docs is Deploy Classic's), and a full export over
KV Connect takes hours from a laptop, holds the whole database in memory, and
writes nothing if one request fails. Most of what it reads is bot traffic: a
honeypot run left well over a million `user` rows.

What can't be rebuilt is the players: their names, their solutions and their
login links. Old-timers have months of solves; losing those loses them.

## Approach

Back up the players and nothing else: every hour by cron, to Google Cloud
Storage, or by hand to a file. Restore either into any database.

- **Who's a player:** everyone with a solution (the user ids under
  `solutions_by_user`) and everyone with a login (`["auth", sub, "userId"]`).
  The `user` prefix itself is never scanned, so bot rows cost nothing.
- **What's kept per player:** their `user` entries (the record and their puzzle
  draft), every solution under all four of its index keys
  (`solutions_by_puzzle`, `solutions_by_puzzle_canonical`, `solutions_by_user`,
  `solutions_by_user_puzzle`) and their `auth` link. Once the stars stack is
  in, their score too (`solution_score_by_user_puzzle`, `user_score`). Index
  keys are read, not worked out, so the file is exactly what was stored.
- **Each backup is a full copy of that set,** not a diff: small enough to redo
  every hour, and any one file restores on its own.
- **The file:** JSON Lines in `lib/kv-json.ts`'s format, keeping dates, big
  integers, bytes and KV's counters. The cron names it by the hour,
  `players/2026-11-08T11.jsonl`.
- **By hand:** `scripts/backup-kv.ts <file>` writes the same file locally, from
  local KV or, with `SKUB_KV_URL`, a hosted database, e.g. production onto
  preview.
- **Restore:** `scripts/restore-kv.ts <file> --confirm` writes every entry over
  what's there, 100 to a commit, and leaves the rest alone (and, with the
  stars stack in, `scripts/reindex-highscore.ts` rebuilds the high score).
- **Where:** `gs://skub-kv-backups` (project `skub-app`, `us-east4`, next to
  KV), written through Deploy's GCP cloud connection with
  `@google-cloud/storage`; no keys anywhere. The service account can create
  objects and nothing else, so the app can't delete or overwrite a backup. The
  SDK loads inside the job, so it stays out of every request's cold start.
- **How long:** a bucket lifecycle rule deletes `players/` files after 30 days,
  on Google's side.
- **Production only:** crons also run on git branch timelines. The cloud
  connection exists only in the Production context, so the job does nothing
  where `GCP_SERVICE_ACCOUNT_EMAIL` is unset; elsewhere it couldn't
  authenticate anyway.
- **Reads stream:** prefixes are read at once, in batches as they come, not
  through the app's traced `kv.list`, which collects a whole list before
  returning it.
- **Failures:** a few retries with backoff; Deploy skips a run while the last
  one is still going. One span per run with the player, entry and byte counts.

Branch agnostic: off main, not part of the stars stack, and it lands first,
so production has a backup before the stack's migration runs. It brings
`lib/kv-json.ts` along from `stars/rules`; the stack drops the duplicate when
it rebases onto main.

## Non-goals

- Shared and derived data: `puzzle_stats`, `puzzle_solvers`, `flash_solve_count`,
  path claims and solution groups, the `highscore` index. Rebuildable, or a
  count that can be off without anyone losing anything.
- A full dump of the database: the stars stack keeps its export for the
  migration's snapshot.
- Incremental backups from a change log on every write (if an hour turns out
  too coarse).
- Cleaning out the bot `user` rows: its own decision, deleting from production.

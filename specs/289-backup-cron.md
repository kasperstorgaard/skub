# Players' data is backed up every hour

Production KV has no backup. The new Deno Deploy has no built-in one (the
continuous S3 backup in the docs is Deploy Classic's), and a full export over
KV Connect takes hours from a laptop, holds the whole database in memory, and
writes nothing if one request fails. Most of what it reads is bot traffic: a
honeypot run left well over a million `user` rows.

What can't be rebuilt is the players: their names, their solutions and their
login links. Old-timers have months of solves; losing those loses them.

## Approach

Back up everything but the bot rows: every hour by cron, to Google Cloud
Storage, or by hand to a file. Restore either into any database.

- **Every prefix whole,** derived ones too (`puzzle_stats`, `puzzle_solvers`,
  `flash_solve_count`, sessions), so nothing counts on a rebuild script.
- **But `user`, per player:** the honeypot left over a million default records
  from before GETs stopped writing to KV (#244), so the prefix is too big to
  scan. Instead the records (and puzzle drafts) of everyone who ever solved or
  logged in are read by key, found through `solutions_by_user` and `auth`.
  Visitors who only did the tutorial or saved a theme are the gap; the old
  rows stay behind when hosting moves, and then `user` is backed up whole.
- **Each backup is a full copy,** not a diff: small enough to redo every hour,
  and any one file restores on its own. Production today: 1,241 players,
  95,662 entries, 50 MB, in 20 s from a laptop.
- **Not a snapshot:** prefixes are read moments apart, so a solve landing
  mid-backup can be under some of its keys and not others. The next hour's
  file has it whole.
- **The file:** JSON Lines in `lib/kv-json.ts`'s format, keeping dates, big
  integers, bytes and KV's counters. The cron names it by the hour,
  `players/2026-11-08T11.jsonl`.
- **By hand:** `scripts/backup-kv.ts <file>` writes the same file locally, from
  local KV or, with `SKUB_KV_URL`, a hosted database, e.g. production onto
  preview.
- **Restore:** `scripts/restore-kv.ts <file> --confirm` writes every entry over
  what's there, 100 to a commit, and leaves the rest alone. Tested:
  production's backup restored onto preview, every entry back with the same
  value.
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

## An evolving procedure

The backup follows the app, not the other way round:

- `db/backup-keys.ts` lists every prefix the app writes. A new one is backed
  up by default, and a test reading `db/` fails until it's listed, so no
  feature adds data the backup silently misses.
- The stars stack hits that test when it rebases (its score, highscore and
  path keys); it backs them up first, and after it lands, what turned out
  derived can be trimmed.
- A restore drill now and then, and before any migration: production onto
  preview, then the pages clicked through. That's how the solutions page's
  path groups were found missing.

Branch agnostic: off main, not part of the stars stack, and it lands first,
so production has a backup before the stack's migration runs. It brings
`lib/kv-json.ts` along from `stars/rules`; the stack drops the duplicate when
it rebases onto main.

## Non-goals

- A full dump of the database: the stars stack keeps its export for the
  migration's snapshot.
- Incremental backups from a change log on every write (if an hour turns out
  too coarse).
- Deleting the old bot `user` rows from production: they stay behind when
  hosting moves (in TODO.md's hosting item).

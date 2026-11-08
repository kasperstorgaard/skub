/**
 * Migrates stored solves to stars: marks the first solve of each path, by
 * solve order (solution ids are ULIDs, so a puzzle's solutions list oldest
 * first), awards the score past solves earned, and deletes the retired
 * puzzle stats.
 *
 * Run from an up-to-date main: minimum moves come from the puzzle files here.
 * Locally: deno run -A ./scripts/migrate-score.ts [--dry-run]
 *
 * Against production, over KV Connect, after ./scripts/backup-kv.ts (undo
 * with ./scripts/restore-kv.ts):
 * SKUB_KV_URL=https://api.deno.com/v2/databases/<id>/connect \
 * DENO_KV_ACCESS_TOKEN=ddo_... deno run -A ./scripts/migrate-score.ts --dry-run
 *
 * `--dry-run` reads everything and writes nothing. Safe to run again: it
 * keeps a player's best and never takes a star back.
 */
import { kv } from "#/db/kv.ts";
import { awardPastScore } from "#/db/score.ts";
import { updateSolutions } from "#/db/solutions.ts";
import type { Solution } from "#/db/types.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { getPastScore, type ScoreKind, withFirstSolves } from "#/game/score.ts";

const isDryRun = Deno.args.includes("--dry-run");

const PUZZLES_DIR = "./static/puzzles";

const minMovesBySlug = new Map<string, number>();
for (const entry of Deno.readDirSync(PUZZLES_DIR)) {
  if (!entry.isFile || !entry.name.endsWith(".md")) continue;
  try {
    const puzzle = parsePuzzle(
      await Deno.readTextFile(`${PUZZLES_DIR}/${entry.name}`),
    );
    minMovesBySlug.set(puzzle.slug, puzzle.minMoves);
  } catch (err) {
    console.error(`${entry.name}: unreadable, ${(err as Error).message}`);
  }
}

// Keys sort by slug, then id: each puzzle's solutions in solve order.
const solvesBySlug = new Map<string, Solution[]>();
for await (
  const { value } of kv.list<Solution>({ prefix: ["solutions_by_puzzle"] })
) {
  const solves = solvesBySlug.get(value.puzzleSlug) ?? [];
  solves.push(value);
  solvesBySlug.set(value.puzzleSlug, solves);
}

// Worked out in memory first, then written in parallel: one round trip at a
// time to KV, far away over KV Connect, would take an hour.
const toMark: Solution[] = [];
const scoreByUser = new Map<string, Map<string, ScoreKind[]>>();
const unknown: string[] = [];
for (const [slug, solves] of solvesBySlug) {
  const minMoves = minMovesBySlug.get(slug);
  if (minMoves === undefined) {
    unknown.push(slug);
    continue;
  }

  // First over every solve; one with no user has no keys to mark or award.
  const firstSolves = withFirstSolves(solves);
  for (const [i, solve] of firstSolves.entries()) {
    if (solve.userId && !!solve.first !== !!solves[i].first) {
      toMark.push(solve);
    }
  }

  const pastScore = getPastScore(
    { minMoves },
    firstSolves.filter((solve) => solve.userId),
  );
  for (const [userId, kinds] of pastScore) {
    const byPuzzle = scoreByUser.get(userId) ?? new Map();
    byPuzzle.set(slug, kinds);
    scoreByUser.set(userId, byPuzzle);
  }
}

/** Runs `run` over `items`, `limit` at a time. */
async function inParallel<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
}

let awarded = 0;
let marked = 0;
let failed = 0;
if (isDryRun) {
  marked = toMark.length;
  for (const byPuzzle of scoreByUser.values()) {
    for (const kinds of byPuzzle.values()) awarded += kinds.length;
  }
} else {
  const batches = Array.from(
    { length: Math.ceil(toMark.length / 50) },
    (_, i) => toMark.slice(i * 50, (i + 1) * 50),
  );
  await inParallel(batches, 10, async (batch) => {
    try {
      await updateSolutions(batch);
      marked += batch.length;
    } catch (err) {
      failed += batch.length;
      console.error(`marking ${batch.length}: ${(err as Error).message}`);
    }
  });

  await inParallel([...scoreByUser], 20, async ([userId, byPuzzle]) => {
    try {
      // Awaited first: `awarded += await` would read it before the wait.
      const added = await awardPastScore(userId, byPuzzle);
      awarded += added;
    } catch (err) {
      failed++;
      console.error(`${userId}: ${(err as Error).message}`);
    }
  });
}

// Retired stats. The old code writes them until the deploy, so the run after
// it clears them for good.
const retiredPrefixes = ["puzzle_stats", "puzzle_solvers", "flash_solve_count"];
const retiredKeys: Deno.KvKey[] = [];
for (const prefix of retiredPrefixes) {
  for await (const { key } of kv.list({ prefix: [prefix] })) {
    retiredKeys.push(key);
  }
}
let deleted = 0;
if (!isDryRun) {
  const batches = Array.from(
    { length: Math.ceil(retiredKeys.length / 500) },
    (_, i) => retiredKeys.slice(i * 500, (i + 1) * 500),
  );
  await inParallel(batches, 10, async (batch) => {
    const atomic = kv.atomic();
    for (const key of batch) atomic.delete(key);
    try {
      await atomic.commit();
      deleted += batch.length;
    } catch (err) {
      failed += batch.length;
      console.error(`deleting ${batch.length}: ${(err as Error).message}`);
    }
  });
} else {
  deleted = retiredKeys.length;
}

console.log(
  isDryRun
    ? `Dry run, nothing written: would award up to ${awarded} stars and mark ${marked} first solves.`
    : `Awarded ${awarded} stars, marked ${marked} first solves.`,
);
console.log(
  `${isDryRun ? "Would delete" : "Deleted"} ${deleted} retired stats keys.`,
);
if (failed) console.log(`${failed} writes failed: run again to retry them.`);
if (unknown.length) {
  console.log(`No puzzle file, skipped: ${unknown.join(", ")}`);
}

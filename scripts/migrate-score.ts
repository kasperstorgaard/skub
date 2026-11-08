/**
 * Migrates stored solves to stars: marks the first solve of each path, by
 * solve order (solution ids are ULIDs, so a puzzle's solutions list oldest
 * first), and awards the score past solves earned.
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
import { awardScore } from "#/db/score.ts";
import { updateSolution } from "#/db/solutions.ts";
import type { Solution } from "#/db/types.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { getPastScore, withFirstSolves } from "#/game/score.ts";

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

let awarded = 0;
let marked = 0;
let failed = 0;
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
    if (!solve.userId || !!solve.first === !!solves[i].first) continue;
    if (isDryRun) {
      marked++;
      continue;
    }
    try {
      await updateSolution(solve);
      marked++;
    } catch (err) {
      failed++;
      console.error(`${slug} ${solve.id}: ${(err as Error).message}`);
    }
  }

  const scoreByUser = getPastScore(
    { minMoves },
    firstSolves.filter((solve) => solve.userId),
  );
  for (const [userId, kinds] of scoreByUser) {
    if (isDryRun) {
      awarded += kinds.length;
      continue;
    }
    try {
      awarded += (await awardScore(userId, slug, kinds)).length;
    } catch (err) {
      failed++;
      console.error(`${slug} ${userId}: ${(err as Error).message}`);
    }
  }
  console.log(`${slug}: ${solves.length} solves, ${scoreByUser.size} players`);
}

console.log(
  isDryRun
    ? `Dry run, nothing written: would award up to ${awarded} stars and mark ${marked} first solves.`
    : `Awarded ${awarded} stars, marked ${marked} first solves.`,
);
if (failed) console.log(`${failed} writes failed: run again to retry them.`);
if (unknown.length) {
  console.log(`No puzzle file, skipped: ${unknown.join(", ")}`);
}

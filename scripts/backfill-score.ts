/**
 * Awards the score past solves earned, so the high score isn't empty on day
 * one. First goes by solve order: solution ids are ULIDs, so a puzzle's
 * solutions list oldest first. Each first solve is marked `first` on the
 * solution too, so counts can come from the solutions alone. Run against production with:
 * deno run --tunnel -A ./scripts/backfill-score.ts
 *
 * Run from an up-to-date main: minimum moves come from the puzzle files here.
 *
 * Safe to run again: awarding skips what a player has, so a re-run only adds
 * points a live award missed. It never takes back a point awarded wrongly.
 */
import { kv } from "#/db/kv.ts";
import { awardScore } from "#/db/score.ts";
import { updateSolution } from "#/db/solutions.ts";
import type { Solution } from "#/db/types.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { getPastScore, withFirstSolves } from "#/game/score.ts";

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
  // Ids were always ULIDs, but a solve with no user has no one to award.
  if (!value.userId) continue;
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

  const firstSolves = withFirstSolves(solves);
  for (const [i, solve] of firstSolves.entries()) {
    if (!!solve.first === !!solves[i].first) continue;
    try {
      await updateSolution(solve);
      marked++;
    } catch (err) {
      failed++;
      console.error(`${slug} ${solve.id}: ${(err as Error).message}`);
    }
  }

  const scoreByUser = getPastScore({ minMoves }, firstSolves);
  for (const [userId, kinds] of scoreByUser) {
    try {
      awarded += (await awardScore(userId, slug, kinds)).length;
    } catch (err) {
      failed++;
      console.error(`${slug} ${userId}: ${(err as Error).message}`);
    }
  }
  console.log(`${slug}: ${solves.length} solves, ${scoreByUser.size} players`);
}

console.log(`Awarded ${awarded} points, marked ${marked} first solves.`);
if (failed) console.log(`${failed} writes failed: run again to retry them.`);
if (unknown.length) {
  console.log(`No puzzle file, skipped: ${unknown.join(", ")}`);
}

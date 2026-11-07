/**
 * Awards the score past solves earned, so the high score isn't empty on day
 * one. First goes by solve order: solution ids are ULIDs, so a puzzle's
 * solutions list oldest first. Run against production with:
 * deno run --tunnel -A ./scripts/backfill-score.ts
 *
 * Safe to run again: awarding skips what a player has, so a re-run only adds
 * points a live award missed.
 */
import { kv } from "#/db/kv.ts";
import { awardScore } from "#/db/score.ts";
import type { Solution } from "#/db/types.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { getPastScore } from "#/game/score.ts";

const PUZZLES_DIR = "./static/puzzles";

const minMovesBySlug = new Map<string, number>();
for (const entry of Deno.readDirSync(PUZZLES_DIR)) {
  if (!entry.isFile || !entry.name.endsWith(".md")) continue;
  const puzzle = parsePuzzle(
    await Deno.readTextFile(`${PUZZLES_DIR}/${entry.name}`),
  );
  minMovesBySlug.set(puzzle.slug, puzzle.minMoves);
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
const unknown: string[] = [];
for (const [slug, solves] of solvesBySlug) {
  const minMoves = minMovesBySlug.get(slug);
  if (minMoves === undefined) {
    unknown.push(slug);
    continue;
  }

  const scoreByUser = getPastScore({ minMoves }, solves);
  for (const [userId, kinds] of scoreByUser) {
    awarded += (await awardScore(userId, slug, kinds)).length;
  }
  console.log(`${slug}: ${solves.length} solves, ${scoreByUser.size} players`);
}

console.log(`Awarded ${awarded} points.`);
if (unknown.length) {
  console.log(`No puzzle file, skipped: ${unknown.join(", ")}`);
}

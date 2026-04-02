/**
 * Solves all puzzles with missing or zero minMoves and writes the result back.
 * Reads and solves in parallel — one worker per puzzle.
 *
 * Usage: deno task update-puzzles
 */
import { formatPuzzle } from "#/game/formatter.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { solveSync } from "#/game/solver.ts";

const PUZZLES_DIR = new URL("../static/puzzles", import.meta.url).pathname;
const updateAll = Deno.env.get("UPDATE_ALL");

const entries: { path: string; name: string }[] = [];
console.time("update-puzzles");

for await (const entry of Deno.readDir(PUZZLES_DIR)) {
  if (entry.isFile && entry.name.endsWith(".md")) {
    entries.push({ path: `${PUZZLES_DIR}/${entry.name}`, name: entry.name });
  }
}

// Read all files in parallel
const puzzles = await Promise.all(
  entries.map(async ({ path, name }) => {
    const markdown = await Deno.readTextFile(path);
    return { path, name, puzzle: parsePuzzle(markdown) };
  }),
);

let nextNumber = 0;
for (const { puzzle } of puzzles) {
  if (puzzle.number > nextNumber) nextNumber = puzzle.number;
}
nextNumber++;

const toSolve = updateAll
  ? puzzles
  : puzzles.filter(({ puzzle }) => !puzzle.minMoves);
const skipped = puzzles.length - toSolve.length;

console.log(
  updateAll
    ? `Solving ${toSolve.length} puzzles...`
    : `Solving ${toSolve.length} puzzles (${skipped} already have minMoves)...`,
);

let updated = 0;
let failed = 0;

// Solve all in parallel — each runs in its own worker
for (const { path, name, puzzle } of toSolve) {
  try {
    const moves = solveSync(puzzle.board);
    const markdown = formatPuzzle({
      ...puzzle,
      minMoves: moves.length,
      number: puzzle.number != null ? puzzle.number : nextNumber++,
    });

    await Deno.writeTextFile(path, markdown);
    console.log(`  ${name}:${moves.length} moves`);
    updated++;
  } catch (err) {
    console.error(`  ${name}: failed — ${(err as Error).message}`);
    failed++;
  }
}
console.log(
  `\nDone. Updated: ${updated}, skipped: ${skipped}, failed: ${failed}`,
);

console.timeEnd("update-puzzles");

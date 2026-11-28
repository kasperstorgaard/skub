/**
 * Adds a generated Flash start to every puzzle that's long enough for Flash and
 * doesn't have one. Promotion generates it for new puzzles; this covers the
 * ones shipped before Flash. Run with: deno run -A ./scripts/backfill-flash-starts.ts
 *
 * Inserts one frontmatter line rather than reformatting, so boards stay
 * byte-for-byte as they were.
 */
import { generateFlashStart, getFlashStartLength } from "#/game/flash.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { encodeMoves } from "#/game/strings.ts";

const PUZZLES_DIR = "./static/puzzles";

const files = [...Deno.readDirSync(PUZZLES_DIR)]
  .filter((entry) => entry.isFile && entry.name.endsWith(".md"))
  .map((entry) => `${PUZZLES_DIR}/${entry.name}`)
  .sort();

let added = 0;
const unsolved: string[] = [];
for (const path of files) {
  const content = await Deno.readTextFile(path);
  const puzzle = parsePuzzle(content);
  if (puzzle.flashStart) continue;

  const started = performance.now();
  const flashStart = generateFlashStart(puzzle);
  if (!flashStart) {
    if (getFlashStartLength(puzzle.minMoves) > 0) unsolved.push(puzzle.slug);
    continue;
  }

  // The frontmatter's closing fence is the second "---" line.
  const close = content.indexOf("\n---", 3);
  const line = `\nflashStart: ${encodeMoves(flashStart)}`;
  await Deno.writeTextFile(
    path,
    content.slice(0, close) + line + content.slice(close),
  );

  added++;
  const ms = Math.round(performance.now() - started);
  console.log(`${puzzle.slug}: ${encodeMoves(flashStart)} (${ms} ms)`);
}

console.log(`Added ${added} Flash starts.`);
if (unsolved.length) {
  console.log(`Too big to solve, no Flash: ${unsolved.join(", ")}`);
}

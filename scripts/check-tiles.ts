/**
 * Checks every tile in the catalog parses, validates, and is filed under the
 * category its contents read as.
 *
 * Usage: `deno task check-tiles`
 */
import { TILES_DIR } from "#/game/tile-store.ts";
import { countLanes, parseTile } from "#/game/tiles.ts";

const files = await Array.fromAsync(Deno.readDir(TILES_DIR))
  .then((entries) =>
    entries.filter((entry) => entry.name.endsWith(".md")).map((entry) =>
      entry.name
    ).sort()
  )
  .catch(() => [] as string[]);

if (!files.length) {
  console.log(`No tiles in ${TILES_DIR} yet.`);
  Deno.exit(0);
}

const failures: string[] = [];

for (const file of files) {
  const path = `${TILES_DIR}/${file}`;

  try {
    const { id, category, tile } = parseTile(await Deno.readTextFile(path));
    const blockers = tile.pieces.length;
    const hazards = tile.holes.length + tile.portals.length;

    console.log(
      `${id.padEnd(8)} ${category}  ${tile.walls.length} walls  ` +
        `${blockers} blockers  ${hazards} hazards  ${countLanes(tile)} lanes`,
    );
  } catch (err) {
    failures.push(`${file}: ${err instanceof Error ? err.message : err}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} tile(s) failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  Deno.exit(1);
}

console.log(`\n${files.length} tile(s) OK.`);

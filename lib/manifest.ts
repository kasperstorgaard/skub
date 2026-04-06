// deno-lint-ignore-file skub-imports/import-order skub-imports/use-hash-alias ban-unused-ignore
import { extractYaml } from "@std/front-matter";

import { Puzzle, PuzzleManifestEntry } from "../game/types.ts";

const PUZZLES_DIR = "./static/puzzles";

/**
 * Regenerates the puzzle manifest from the markdown files in static/puzzles.
 * Reads all .md files, extracts YAML front matter, and writes manifest.json.
 */
export async function updateManifest() {
  let entries: PuzzleManifestEntry[] = [];

  for await (const entry of Deno.readDir(PUZZLES_DIR)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      const content = await Deno.readTextFile(
        `${PUZZLES_DIR}/${entry.name}`,
      );
      const { attrs } = extractYaml<Omit<Puzzle, "board">>(content);

      entries.push({
        number: attrs.number,
        slug: attrs.slug,
        name: attrs.name,
        createdAt: attrs.createdAt,
        difficulty: attrs.difficulty,
        minMoves: attrs.minMoves,
        onboardingLevel: attrs.onboardingLevel,
      });
    }
  }

  // Sort all by number
  entries = entries.sort((a, b) => (b.number ?? 0) - (a.number ?? 0));

  await Deno.writeTextFile(
    `${PUZZLES_DIR}/manifest.json`,
    JSON.stringify(entries, null, 2),
  );
}

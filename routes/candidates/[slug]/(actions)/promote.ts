import { slug as slugify } from "@annervisser/slug";
import { HttpError } from "fresh";

import { define } from "#/core.ts";
import {
  readCandidate,
  takenSlugs,
  writeCandidate,
} from "#/game/candidate-store.ts";
import { promoteTarget } from "#/game/candidates.ts";
import { formatPuzzle } from "#/game/formatter.ts";
import { invalidateCorpus } from "#/game/loader.ts";
import type { Puzzle } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";
import { nextPuzzleNumber, updateManifest } from "#/lib/manifest.ts";

const PUZZLES_DIR = "./static/puzzles";

/**
 * Promotes a reviewed candidate into the corpus: writes the plain puzzle to
 * `static/puzzles` and regenerates the manifest. Only the `Puzzle` fields
 * travel; the feedback and analysis stay in the store. Always a new puzzle — a
 * shipped one is never overwritten. A board with no usable name goes back to
 * the page's name dialog, which posts the chosen `name` here.
 */
export const handler = define.handlers({
  async POST(ctx) {
    // Dev-only: production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const candidate = await readCandidate(ctx.params.slug);
    if (!candidate) throw new HttpError(404, "Not found");

    const page = `/candidates/${candidate.slug}`;
    if (candidate.promotedAs) {
      return new Response("", { headers: { Location: page }, status: 303 });
    }

    const taken = await takenSlugs(candidate.slug);
    const target = promoteTarget(candidate, { takenSlugs: taken });
    if (target.type === "shipped") {
      return new Response("", { headers: { Location: page }, status: 303 });
    }

    let name: string;
    let slug: string;
    if (target.type === "ask") {
      name = (await ctx.req.formData()).get("name")?.toString().trim() ?? "";
      slug = slugify(name);

      // Back to the dialog with what was typed, and why it can't ship.
      const error = !slug ? "empty" : taken.has(slug) ? "taken" : null;
      if (error) {
        const params = new URLSearchParams({ dialog: "promote", error, name });
        return new Response("", {
          headers: { Location: `${page}?${params}` },
          status: 303,
        });
      }
    } else {
      ({ name, slug } = target);
    }

    const puzzle: Puzzle = {
      number: await nextPuzzleNumber(),
      name,
      slug,
      createdAt: new Date(Date.now()),
      difficulty: candidate.difficulty,
      minMoves: candidate.minMoves,
      board: candidate.board,
    };

    // `createNew` fails rather than overwrite: shipped puzzles are immutable.
    await Deno.writeTextFile(
      `${PUZZLES_DIR}/${puzzle.slug}.md`,
      formatPuzzle(puzzle),
      { createNew: true },
    );
    await updateManifest();
    // The loader caches the manifest it read at boot.
    invalidateCorpus();

    await writeCandidate({ ...candidate, promotedAs: puzzle.slug });

    return new Response("", { headers: { Location: page }, status: 303 });
  },
});

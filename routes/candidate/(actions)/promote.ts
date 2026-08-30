import { HttpError } from "fresh";

import { define } from "#/core.ts";
import {
  readCandidate,
  stripVariant,
  writeCandidate,
} from "#/game/candidate-store.ts";
import { formatPuzzle } from "#/game/formatter.ts";
import { getPuzzle, invalidateCorpus } from "#/game/loader.ts";
import type { Puzzle } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";
import { nextPuzzleNumber, updateManifest } from "#/lib/manifest.ts";

const PUZZLES_DIR = "./static/puzzles";

/**
 * Promotes a reviewed candidate into the corpus: writes the plain puzzle to
 * `static/puzzles` and regenerates the manifest.
 *
 * Only the `Puzzle` fields travel. Rating, tags, note, analysis and generator
 * provenance stay in the store — they're the record of *how* the board earned
 * its place, and the corpus file is the board itself.
 *
 * A promoted puzzle arrives complete, so nothing downstream has to repair it:
 * `minMoves` and `difficulty` from the analysis, and the next free schedule
 * number, so it queues up behind what's already there instead of waiting for
 * `update-puzzles` to notice it.
 *
 * A variant ships under its base name (`erik-b` becomes `erik`) and replaces
 * what's there, keeping that puzzle's slot and creation date — the point of
 * editing a promoted board is to change the board, not to reschedule it. The
 * candidate records what it shipped as, because "does a puzzle by this name
 * exist" answers about the base, not about the variant that supplied it.
 */
export const handler = define.handlers({
  async GET(ctx) {
    // Dev-only: production's filesystem is read-only, and this is the write
    // that puts a puzzle in front of players.
    if (!isDev) throw new HttpError(404, "Not found");

    const requested = new URL(ctx.req.url).searchParams.get("slug");
    const candidate = requested ? await readCandidate(requested) : null;
    if (!candidate) throw new HttpError(404, "Not found");

    // Already shipped: leave it alone. The button is hidden once a board is
    // promoted, but the URL is an ordinary link — a back-navigation must not
    // rewrite a released puzzle.
    if (candidate.promotedAs) {
      return new Response("", {
        headers: { Location: `/candidate?slug=${candidate.slug}` },
        status: 303,
      });
    }

    const slug = stripVariant(candidate.slug);
    const shipped = await getPuzzle(slug);

    const puzzle: Puzzle = {
      // Replacing a released puzzle keeps its day; a new one takes the next.
      number: shipped?.number ?? await nextPuzzleNumber(),
      name: stripVariant(candidate.name),
      slug,
      createdAt: shipped?.createdAt ?? new Date(Date.now()),
      difficulty: candidate.difficulty,
      minMoves: candidate.minMoves,
      board: candidate.board,
    };

    await Deno.writeTextFile(
      `${PUZZLES_DIR}/${puzzle.slug}.md`,
      formatPuzzle(puzzle),
    );
    await updateManifest();
    // The manifest on disk isn't enough: the loader read its copy at boot and
    // caches it for the life of the process.
    invalidateCorpus();

    await writeCandidate({ ...candidate, promotedAs: puzzle.slug });

    return new Response("", {
      headers: { Location: `/candidate?slug=${candidate.slug}` },
      status: 303,
    });
  },
});

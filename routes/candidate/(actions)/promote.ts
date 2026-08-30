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
 * `static/puzzles` and regenerates the manifest. Only the `Puzzle` fields
 * travel; the feedback and analysis stay in the store. A variant ships under
 * its base name (`erik-b` → `erik`), replacing that puzzle in its own slot.
 */
export const handler = define.handlers({
  async GET(ctx) {
    // Dev-only: production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const requested = new URL(ctx.req.url).searchParams.get("slug");
    const candidate = requested ? await readCandidate(requested) : null;
    if (!candidate) throw new HttpError(404, "Not found");

    // Already shipped: the Promote button is hidden, but the URL stays an
    // ordinary link a back-navigation can re-enter.
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
    // The loader caches the manifest it read at boot.
    invalidateCorpus();

    await writeCandidate({ ...candidate, promotedAs: puzzle.slug });

    return new Response("", {
      headers: { Location: `/candidate?slug=${candidate.slug}` },
      status: 303,
    });
  },
});

import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { getUserPuzzleDraft } from "#/db/user.ts";
import { isBoardSame } from "#/game/board.ts";
import {
  nextVariant,
  pickCandidateName,
  readCandidate,
  upsertCandidate,
} from "#/game/candidate-store.ts";
import type { CandidateSource } from "#/game/candidates.ts";
import { getPuzzle } from "#/game/loader.ts";
import type { Puzzle } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

/**
 * Which entry a draft sent to review belongs to. An unchanged board keeps its
 * own name and source; a changed one forks to the next variant of whatever it
 * came from (`erik` → `erik-b`), so the rated board is never overwritten.
 */
async function identify(
  draft: Puzzle,
): Promise<{ name: string; slug: string; source?: CandidateSource }> {
  const corpus = await getPuzzle(draft.slug);
  if (corpus && isBoardSame(corpus.board, draft.board)) {
    return { name: corpus.name, slug: corpus.slug, source: "corpus" };
  }

  const stored = await readCandidate(draft.slug);
  if (stored && isBoardSame(stored.board, draft.board)) {
    // Its own source stands — `upsertCandidate` keeps it when none is given.
    return { name: stored.name, slug: stored.slug };
  }

  const origin = stored ?? corpus;
  const variant = origin && await nextVariant(origin);
  if (variant) return { ...variant, source: "edited" };

  return { ...await pickCandidateName(), source: "edited" };
}

/**
 * Sends the current editor draft to review as a candidate: analyses the board,
 * writes the entry and hands off to `/candidate`. The editor's only write —
 * the corpus write lives on `/candidate`, behind Promote.
 */
export const handler = define.handlers({
  async GET(ctx) {
    // Dev-only: production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const draft = await getUserPuzzleDraft(ctx.state.userId);
    if (!draft) throw new HttpError(400, "No stored puzzle");

    const { name, slug, source } = await identify(draft);

    // Analysis solves the board, and an unfinished one may not solve at all —
    // an ordinary state to be in mid-edit, so say so rather than throw a 500.
    let candidate;
    try {
      candidate = await upsertCandidate({ ...draft, name, slug }, source);
    } catch (err) {
      throw new HttpError(
        400,
        `Could not analyse this board — ${
          err instanceof Error ? err.message : "solve failed"
        }`,
      );
    }

    return new Response("", {
      headers: { Location: `/candidate?slug=${candidate.slug}` },
      status: 303,
    });
  },
});

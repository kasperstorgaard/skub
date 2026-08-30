import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { getUserPuzzleDraft } from "#/db/user.ts";
import {
  nextVariant,
  pickCandidateName,
  readCandidate,
  sameBoard,
  SLUG_PATTERN,
  upsertCandidate,
} from "#/game/candidate-store.ts";
import type { CandidateSource } from "#/game/candidates.ts";
import { getPuzzle } from "#/game/loader.ts";
import type { Puzzle } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

/**
 * Which entry a draft sent to review belongs to.
 *
 * An unchanged board is itself: a corpus puzzle keeps its own slug and name
 * (a rating filed under a minted name is useless as an anchor), and a stored
 * candidate keeps its entry and its source.
 *
 * A changed board is a new candidate, never an overwrite — a rating describes
 * the board it was given to, so editing forks rather than mutates. It lands as
 * the next variant of whatever it came from (`erik` → `erik-b`), which keeps
 * the relationship legible without tracking lineage anywhere; a board with no
 * recognisable origin just gets a fresh name.
 */
async function identify(
  draft: Puzzle,
): Promise<{ name: string; slug: string; source?: CandidateSource }> {
  if (SLUG_PATTERN.test(draft.slug)) {
    const corpus = await getPuzzle(draft.slug);
    if (corpus && sameBoard(corpus.board, draft.board)) {
      return { name: corpus.name, slug: corpus.slug, source: "corpus" };
    }

    const stored = await readCandidate(draft.slug);
    if (stored && sameBoard(stored.board, draft.board)) {
      // Its own source stands — `upsertCandidate` keeps it when none is given.
      return { name: stored.name, slug: stored.slug };
    }

    const origin = stored ?? corpus;
    const variant = origin && await nextVariant(origin);
    if (variant) return { ...variant, source: "edited" };
  }

  return { ...await pickCandidateName(), source: "edited" };
}

/**
 * Sends the current editor draft to review as a candidate — a deliberate act,
 * so that idle fiddling never lands in the store. Analyses the board, writes
 * the entry and hands off to `/candidate`, where it's played, read and rated
 * like any other.
 *
 * This is the editor's only write. There used to be a Save that put a board
 * straight into `static/puzzles` and regenerated the manifest, skipping
 * candidacy entirely — the thing the pipeline exists to prevent. The corpus
 * write lives on `/candidate` now, behind Promote, where the board has been
 * played and rated first.
 */
export const handler = define.handlers({
  async GET(ctx) {
    // Dev-only: the store is a directory on disk, and production's filesystem
    // is read-only.
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

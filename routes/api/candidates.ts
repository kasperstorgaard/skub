import { define } from "#/core.ts";
import {
  pickCandidateName,
  readCandidate,
  writeCandidate,
} from "#/game/candidate-store.ts";
import {
  type Candidate,
  parseCandidate,
  REASON_TAG_VALUES,
  type ReasonTag,
  SOLUTION_TAG_VALUES,
  type SolutionTag,
} from "#/game/candidates.ts";
import { isDev } from "#/lib/env.ts";

type CreatePayload = { action: "create"; markdown: string };
type FeedbackPayload = {
  action: "feedback";
  slug: string;
  rating?: number;
  reasons?: ReasonTag[];
  note?: string;
};
type SolutionPayload = {
  action: "solution";
  slug: string;
  /** The route being tagged, in the store's encoded-moves form. */
  moves: string;
  tags: SolutionTag[];
};
type Payload = CreatePayload | FeedbackPayload | SolutionPayload;

/**
 * Persists a freshly generated candidate under an unused Nordic name. The
 * analysis rides along in the posted markdown: the generation run measured it
 * already, and solving the same board a second time server-side would cost
 * seconds for a result we have.
 */
async function create(markdown: string): Promise<Response> {
  let candidate: Candidate;
  try {
    candidate = parseCandidate(markdown);
  } catch {
    return new Response("Invalid puzzle", { status: 400 });
  }

  const { name, slug } = await pickCandidateName();

  await writeCandidate({
    ...candidate,
    name,
    slug,
    source: "generated",
    // Numbers are the corpus schedule; the editor's empty board carries a 0.
    number: undefined,
  });

  return Response.json({ slug, name });
}

/**
 * Sets a candidate's feedback — a full overwrite of rating/reasons/note, not a
 * merge: the client always sends its complete current state, so an omitted
 * field means "cleared". Difficulty is not feedback: it follows the move count,
 * and the corpus file is where it's tweaked before release.
 */
async function saveFeedback(payload: FeedbackPayload): Promise<Response> {
  const { slug, rating, reasons, note } = payload;

  // Half-star steps: 0.5–5, nothing finer. The UI only ever sends halves, so a
  // stray 3.7 means a hand-rolled request, not a curator.
  if (
    rating !== undefined &&
    (rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0)
  ) {
    return new Response("Invalid rating", { status: 400 });
  }
  if (reasons && reasons.some((r) => !REASON_TAG_VALUES.includes(r))) {
    return new Response("Invalid reason", { status: 400 });
  }
  const candidate = await readCandidate(slug);
  if (!candidate) return new Response("Not found", { status: 404 });

  await writeCandidate({ ...candidate, rating, reasons, note });
  return new Response("OK", { status: 200 });
}

/**
 * Tags one solution of a candidate. Unlike `feedback` this is a merge, not a
 * full overwrite: it replaces the entry for one route and leaves the rest of the
 * candidate's feedback — including the puzzle-level star rating, which a
 * different island owns — untouched.
 */
async function saveSolutionTags(payload: SolutionPayload): Promise<Response> {
  const { slug, moves, tags } = payload;

  if (!moves) return new Response("Missing moves", { status: 400 });
  if (
    !Array.isArray(tags) || tags.some((t) => !SOLUTION_TAG_VALUES.includes(t))
  ) {
    return new Response("Invalid tag", { status: 400 });
  }

  const candidate = await readCandidate(slug);
  if (!candidate) return new Response("Not found", { status: 404 });

  const solutionTags = { ...candidate.solutionTags };
  // An emptied route drops out rather than being stored as `[]` — the store is
  // read by eye, and a file full of empty arrays hides the tags that exist.
  if (tags.length) solutionTags[moves] = tags;
  else delete solutionTags[moves];

  await writeCandidate({
    ...candidate,
    solutionTags: Object.keys(solutionTags).length ? solutionTags : undefined,
  });
  return new Response("OK", { status: 200 });
}

/**
 * Localhost-only API for the candidate store. Records a generated candidate
 * (`create`) and the curator's rating/tags/note (`feedback`, `solution`) into
 * the same markdown file. Forbidden in production (Deno Deploy's filesystem is
 * read-only); nothing there reaches it, since candidacy is dev-only throughout.
 */
export const handler = define.handlers({
  async POST(ctx) {
    if (!isDev) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: Payload;
    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (body.action === "create") {
      if (!body.markdown) {
        return new Response("Missing markdown", { status: 400 });
      }
      return await create(body.markdown);
    }

    if (body.action === "feedback") {
      return await saveFeedback(body);
    }

    if (body.action === "solution") {
      return await saveSolutionTags(body);
    }

    return new Response("Invalid action", { status: 400 });
  },
});

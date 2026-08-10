import { slug } from "@annervisser/slug";

import { define } from "#/core.ts";
import {
  formatGenerated,
  GENERATED_DIR,
  type GeneratedCandidate,
  parseGenerated,
  REASON_TAG_VALUES,
  type ReasonTag,
  SOLUTION_TAG_VALUES,
  type SolutionTag,
} from "#/game/generated.ts";
import { getCorpusNames } from "#/game/loader.ts";
import { pickUnusedName } from "#/game/names.ts";
import { DIFFICULTIES, type Difficulty } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

// Guards against path traversal — slugs are machine-assigned from pool names
// (e.g. `hans`, `hans-2`), so a strict lowercase-kebab shape is all that's valid.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type CreatePayload = { action: "create"; markdown: string };
type FeedbackPayload = {
  action: "feedback";
  slug: string;
  rating?: number;
  reasons?: ReasonTag[];
  note?: string;
  difficulty?: Difficulty;
};
type SolutionPayload = {
  action: "solution";
  slug: string;
  /** The route being tagged, in the store's encoded-moves form. */
  moves: string;
  tags: SolutionTag[];
};
type Payload = CreatePayload | FeedbackPayload | SolutionPayload;

// Names already taken by stored candidates. Scanned from disk once, then kept
// current by appending on each create — O(1) per generate instead of re-reading
// the whole store. Dev-only single-user, so drift (a manually deleted file's
// name staying "used") is harmless against a big pool.
let usedGeneratedNames: Set<string> | null = null;

/** The `name` frontmatter of every already-stored generated candidate. */
async function getGeneratedNames(): Promise<Set<string>> {
  if (usedGeneratedNames) return usedGeneratedNames;

  const names = new Set<string>();
  let entries: Deno.DirEntry[] = [];
  try {
    entries = await Array.fromAsync(Deno.readDir(GENERATED_DIR));
  } catch {
    // dir doesn't exist yet
  }
  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    const match = (await Deno.readTextFile(`${GENERATED_DIR}/${entry.name}`))
      .match(/^name:\s*(.+)$/m);
    if (match) names.add(match[1].trim());
  }

  usedGeneratedNames = names;
  return names;
}

/** Whether a candidate file already occupies this slug's slot. */
async function slugTaken(storeSlug: string): Promise<boolean> {
  try {
    await Deno.stat(`${GENERATED_DIR}/${storeSlug}.md`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists a candidate under a random Nordic name unused by any static or
 * generated puzzle (suffixed `Hans-2`-style once the pool runs dry). Name and
 * slug/filename are one thing: `Hans` lives in `hans.md` — no synthetic ids.
 */
async function create(markdown: string): Promise<Response> {
  let candidate: GeneratedCandidate;
  try {
    candidate = parseGenerated(markdown);
  } catch {
    return new Response("Invalid puzzle", { status: 400 });
  }

  const generatedNames = await getGeneratedNames();
  const used = new Set([...await getCorpusNames(), ...generatedNames]);

  // Names are unique, but slugification folds diacritics (Kári and Kari both
  // slug to `kari`) — bump name and slug together until the file slot is free,
  // so the filename always mirrors the name.
  const baseName = pickUnusedName(used);
  let name = baseName;
  let storeSlug = slug(baseName);
  for (let ordinal = 2; await slugTaken(storeSlug); ordinal++) {
    name = `${baseName}-${ordinal}`;
    storeSlug = slug(name);
  }

  candidate.name = name;
  candidate.slug = storeSlug;
  // Drop the `number: 0` noise inherited from the page's empty starting puzzle —
  // numbers are assigned to real corpus puzzles by the manifest, not candidates.
  candidate.number = undefined;
  generatedNames.add(name);

  await Deno.mkdir(GENERATED_DIR, { recursive: true });
  await Deno.writeTextFile(
    `${GENERATED_DIR}/${storeSlug}.md`,
    formatGenerated(candidate),
  );

  return Response.json({ slug: storeSlug, name });
}

/**
 * Sets a candidate's feedback — a full overwrite of rating/reasons/note, not a
 * merge: the client always sends its complete current state, so an omitted
 * field means "cleared".
 *
 * `difficulty` is the exception: it's a required `Puzzle` field seeded from the
 * board's move count at creation, so an omitted one means "unchanged" rather
 * than "cleared" — there is no valid empty state to clear it to.
 */
async function saveFeedback(payload: FeedbackPayload): Promise<Response> {
  const { slug, rating, reasons, note, difficulty } = payload;

  if (!SLUG_PATTERN.test(slug)) {
    return new Response("Invalid slug", { status: 400 });
  }
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
  if (difficulty !== undefined && !DIFFICULTIES.includes(difficulty)) {
    return new Response("Invalid difficulty", { status: 400 });
  }

  const path = `${GENERATED_DIR}/${slug}.md`;
  let candidate: GeneratedCandidate;
  try {
    candidate = parseGenerated(await Deno.readTextFile(path));
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return new Response("Not found", { status: 404 });
    }
    return new Response("Invalid puzzle", { status: 400 });
  }

  candidate.rating = rating;
  candidate.reasons = reasons;
  candidate.note = note;
  if (difficulty) candidate.difficulty = difficulty;

  await Deno.writeTextFile(path, formatGenerated(candidate));
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

  if (!SLUG_PATTERN.test(slug)) {
    return new Response("Invalid slug", { status: 400 });
  }
  if (!moves) return new Response("Missing moves", { status: 400 });
  if (
    !Array.isArray(tags) || tags.some((t) => !SOLUTION_TAG_VALUES.includes(t))
  ) {
    return new Response("Invalid tag", { status: 400 });
  }

  const path = `${GENERATED_DIR}/${slug}.md`;
  let candidate: GeneratedCandidate;
  try {
    candidate = parseGenerated(await Deno.readTextFile(path));
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return new Response("Not found", { status: 404 });
    }
    return new Response("Invalid puzzle", { status: 400 });
  }

  const solutionTags = { ...candidate.solutionTags };
  // An emptied route drops out rather than being stored as `[]` — the store is
  // read by eye, and a file full of empty arrays hides the tags that exist.
  if (tags.length) solutionTags[moves] = tags;
  else delete solutionTags[moves];

  candidate.solutionTags = Object.keys(solutionTags).length
    ? solutionTags
    : undefined;

  await Deno.writeTextFile(path, formatGenerated(candidate));
  return new Response("OK", { status: 200 });
}

/**
 * Localhost-only API for the generator's curation store. Auto-saves every
 * generated candidate (`create`) and records the curator's rating/tags/note
 * (`feedback`) into the same markdown file. Forbidden in production
 * (Deno Deploy's filesystem is read-only); the generator panel degrades to a
 * non-persisted preview.
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

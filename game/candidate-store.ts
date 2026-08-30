/**
 * Disk access for the `candidates/` store, plus the analysis that fills it.
 * Server-side only — never import this from an island; the shapes it reads and
 * writes live in `game/candidates.ts`, which is safe on both sides.
 */
import { slug as slugify } from "@annervisser/slug";

import {
  type Candidate,
  CANDIDATES_DIR,
  type CandidateSource,
  candidateSource,
  formatCandidate,
  parseCandidate,
  type StoredScoring,
  toStoredScoring,
} from "#/game/candidates.ts";
import { getCorpusNames, getPuzzle } from "#/game/loader.ts";
import { pickUnusedName } from "#/game/names.ts";
import {
  CALIBRATION,
  computeMetrics,
  difficultyForMoves,
  scoreBoard,
} from "#/game/scoring.ts";
import { solveExhaustiveSync } from "#/game/solver.ts";
import type { Board, Puzzle } from "#/game/types.ts";

// Guards against path traversal — a slug is either machine-assigned from the
// name pool (e.g. `hans`, `hans-2`) or a corpus puzzle's own, so a strict
// lowercase-kebab shape is all that's valid.
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const candidatePath = (slug: string): string => `${CANDIDATES_DIR}/${slug}.md`;

/** Reads one stored candidate, or null when the store has no such slug. */
export async function readCandidate(slug: string): Promise<Candidate | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  try {
    return parseCandidate(await Deno.readTextFile(candidatePath(slug)));
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    throw err;
  }
}

/**
 * Writes a candidate to its slug's slot, creating the store if needed. An
 * unchanged entry is left alone — every page load re-affirms the one it's
 * showing, and rewriting it would churn the file for nothing.
 */
export async function writeCandidate(candidate: Candidate): Promise<void> {
  if (!SLUG_PATTERN.test(candidate.slug)) {
    throw new Error(`Refusing to write candidate slug: ${candidate.slug}`);
  }
  const path = candidatePath(candidate.slug);
  const markdown = formatCandidate(candidate);
  const current = await Deno.readTextFile(path).catch(() => null);
  if (current === markdown) return;

  await Deno.mkdir(CANDIDATES_DIR, { recursive: true });
  await Deno.writeTextFile(path, markdown);
}

/** Every `.md` in the store, slug-sorted. A missing store yields none. */
async function candidateFiles(): Promise<string[]> {
  try {
    const entries = await Array.fromAsync(Deno.readDir(CANDIDATES_DIR));
    return entries
      .filter((entry) => entry.name.endsWith(".md"))
      .map((entry) => `${CANDIDATES_DIR}/${entry.name}`)
      .toSorted();
  } catch {
    return [];
  }
}

/**
 * The `name` frontmatter of every stored candidate. Read off the line rather
 * than parsed — this only ever feeds the de-duplication set, and parsing every
 * board to reach one string is work for nothing.
 */
async function storedNames(): Promise<string[]> {
  const names: string[] = [];
  for (const path of await candidateFiles()) {
    const match = (await Deno.readTextFile(path)).match(/^name:\s*(.+)$/m);
    if (match) names.push(match[1].trim());
  }
  return names;
}

/** Whether a candidate file already occupies this slug's slot. */
async function slugTaken(slug: string): Promise<boolean> {
  try {
    await Deno.stat(candidatePath(slug));
    return true;
  } catch {
    return false;
  }
}

/**
 * Picks a random Nordic name unused by any corpus puzzle or stored candidate.
 * Name and slug/filename are one thing: `Hans` lives in `hans.md` — no
 * synthetic ids. Names are unique, but slugification folds diacritics (Kári and
 * Kari both slug to `kari`), so the two are bumped together (`Hans-2`) until
 * the file slot is free.
 */
export async function pickCandidateName(): Promise<
  { name: string; slug: string }
> {
  const used = new Set([...await getCorpusNames(), ...await storedNames()]);

  const baseName = pickUnusedName(used);
  let name = baseName;
  let slug = slugify(baseName);
  for (let ordinal = 2; await slugTaken(slug); ordinal++) {
    name = `${baseName}-${ordinal}`;
    slug = slugify(name);
  }
  return { name, slug };
}

/**
 * BFS state budget for an analysis solve. Generous — a shipped puzzle solves in
 * a fraction of it — but bounded, because this one runs inside a request:
 * overshoot explores geometrically more states, and a truncated advisory beats
 * a page that hangs. (The offline reports run uncapped, in a subprocess.)
 */
const ANALYSIS_MAX_STATES = 4_000_000;

/**
 * A variant marker: `erik-b`, `erik-c`. Letters, because the numeric suffix is
 * already taken — `hans-2` means "a different board whose name collided", not a
 * second version of `hans`.
 */
const VARIANT_SUFFIX = /-([b-z])$/;

/** The board a variant hangs off: `erik-b` → `erik`, `hans-2` → `hans-2`. */
export const stripVariant = (value: string): string =>
  value.replace(VARIANT_SUFFIX, "");

/**
 * The next free variant of a board — the name an edit lands under, so the board
 * that was rated keeps its own entry rather than changing underneath it. Null
 * once the letters run out, leaving the caller to mint a fresh name.
 */
export async function nextVariant(
  origin: { name: string; slug: string },
): Promise<{ name: string; slug: string } | null> {
  const name = stripVariant(origin.name);
  const slug = stripVariant(origin.slug);

  for (const letter of "bcdefghijklmnopqrstuvwxyz") {
    if (!await slugTaken(`${slug}-${letter}`)) {
      return { name: `${name}-${letter}`, slug: `${slug}-${letter}` };
    }
  }
  return null;
}

/** The analysis of a board: its optimal move count, every route scored. */
export type Analysis = { minMoves: number; scoring: StoredScoring };

/**
 * Metrics and a score over a board — the analysis, in the shape the store keeps
 * it in. Solves exhaustively with overshoot so the isolation advisories are
 * measured too; this is the seconds-long part, which is why the result is
 * persisted rather than re-derived on every page load.
 */
export function analyseBoard(board: Board): Analysis {
  const result = solveExhaustiveSync(board, {
    overshoot: 2,
    maxStates: ANALYSIS_MAX_STATES,
  });
  return {
    minMoves: result.minMoves,
    scoring: toStoredScoring(
      scoreBoard(board, result),
      computeMetrics(board, result),
    ),
  };
}

/** Whether two boards are the same layout, piece and wall order aside. */
export function sameBoard(a: Board, b: Board): boolean {
  const key = (board: Board) =>
    JSON.stringify({
      destination: board.destination,
      pieces: board.pieces
        .map((piece) => `${piece.type}${piece.x},${piece.y}`).toSorted(),
      walls: board.walls
        .map((wall) => `${wall.orientation}${wall.x},${wall.y}`).toSorted(),
    });
  return key(a) === key(b);
}

/**
 * The candidate for a board, analysed and on disk — the one entry point every
 * way into `/candidate` goes through.
 *
 * An existing entry keeps its feedback and the curator's difficulty call; the
 * board and the analysis are what get refreshed, and the analysis only when the
 * board moved under it or the calibration did. A corpus puzzle enters under its
 * own slug and name, because a rating filed as "Untitled, 0 moves" is useless
 * as an anchor.
 */
export async function upsertCandidate(
  puzzle: Puzzle,
  source?: CandidateSource,
): Promise<Candidate> {
  const stored = await readCandidate(puzzle.slug);

  const candidate: Candidate = {
    ...puzzle,
    // Numbers are the corpus schedule; a candidate has none until promoted, and
    // the editor's empty board carries a `number: 0` worth dropping.
    number: puzzle.number || undefined,
    source: source ?? stored?.source ?? "generated",
    // Feedback and provenance belong to the entry, not to the board it was
    // made from. Same for the difficulty, the measured move count and the
    // creation date: a draft arriving via `clone` has them zeroed and reset,
    // and an unchanged board must not lose what is already on file.
    difficulty: stored?.difficulty ?? puzzle.difficulty,
    minMoves: stored?.minMoves ?? puzzle.minMoves,
    createdAt: stored?.createdAt ?? puzzle.createdAt,
    rating: stored?.rating,
    reasons: stored?.reasons,
    note: stored?.note,
    solutionTags: stored?.solutionTags,
    genOptions: stored?.genOptions,
    generatorVersion: stored?.generatorVersion,
    promotedAs: stored?.promotedAs,
    scoring: stored?.scoring,
  };

  const stale = !candidate.scoring ||
    candidate.scoring.calibrationVersion !== CALIBRATION.version ||
    !stored || !sameBoard(stored.board, puzzle.board);

  if (stale) {
    const analysis = analyseBoard(candidate.board);
    candidate.scoring = analysis.scoring;
    candidate.minMoves = analysis.minMoves;
  }

  // Difficulty is the move count's verdict, not the curator's — but only for
  // entries written from here on. Labels already on disk were set by hand when
  // there was a control for it, and they stay: they're the record of where
  // human judgement and move count disagreed, and re-deriving would erase it.
  if (!stored) candidate.difficulty = difficultyForMoves(candidate.minMoves);

  await writeCandidate(candidate);
  return candidate;
}

/**
 * The candidate for a slug, brought up to date — what every visit to
 * `/candidate` goes through.
 *
 * A corpus entry is a *copy* of a shipped puzzle, so the corpus file is re-read
 * every time rather than trusted to be what it was on the first visit. Editing
 * a board by hand before release is a normal thing to do, and without this the
 * copy freezes: the page would keep rendering the old board, and the rating —
 * which is calibration ground truth — would stay attached to a board that no
 * longer ships.
 */
export async function currentCandidate(
  slug: string,
): Promise<Candidate | null> {
  const stored = await readCandidate(slug);
  if (!stored) return await candidateForCorpusPuzzle(slug);

  if (candidateSource(stored) === "corpus") {
    const corpus = await getPuzzle(slug);
    // A corpus file that has since been deleted leaves the copy as the record.
    if (corpus) return await upsertCandidate(corpus, "corpus");
  }

  return await upsertCandidate(stored);
}

/**
 * The candidate for a corpus puzzle, created on first visit. This is what makes
 * the shipped corpus ratable: the boards that represent "good" become ground
 * truth alongside the generated ones, tagged `corpus` so the two populations
 * stay separable.
 */
export async function candidateForCorpusPuzzle(
  slug: string,
): Promise<Candidate | null> {
  // Same guard as `readCandidate`: this slug reaches a path join too.
  if (!SLUG_PATTERN.test(slug)) return null;
  const puzzle = await getPuzzle(slug);
  if (!puzzle) return null;
  return await upsertCandidate(puzzle, "corpus");
}

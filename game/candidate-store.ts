/**
 * Disk access for the `candidates/` store, plus the analysis that fills it.
 * Server-side only; the shapes it reads and writes live in `game/candidates.ts`.
 */
import { slug as slugify } from "@annervisser/slug";

import { isBoardSame } from "#/game/board.ts";
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

const candidatePath = (slug: string): string => `${CANDIDATES_DIR}/${slug}.md`;

/** Reads one stored candidate, or null when the store has no such slug. */
export async function readCandidate(slug: string): Promise<Candidate | null> {
  try {
    return parseCandidate(await Deno.readTextFile(candidatePath(slug)));
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    throw err;
  }
}

/**
 * Writes a candidate to its slug's slot, creating the store if needed. An
 * unchanged entry is left alone rather than rewritten.
 */
export async function writeCandidate(candidate: Candidate): Promise<void> {
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
 * The `name` frontmatter of every stored candidate, read off the line rather
 * than parsed — this only feeds the de-duplication set.
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
 * Name and file are one thing (`Hans` lives in `hans.md`), and slugification
 * folds diacritics (Kári and Kari both slug to `kari`), so the two are bumped
 * together (`Hans-2`) until the file slot is free.
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
 * BFS state budget for an analysis solve. Generous, but bounded: this one runs
 * inside a request, and a truncated advisory beats a page that hangs.
 */
const ANALYSIS_MAX_STATES = 4_000_000;

/**
 * A variant marker: `erik-b`, `erik-c`. Letters, because a numeric suffix means
 * a name collision (`hans-2`) rather than a second version of a board.
 */
const VARIANT_SUFFIX = /-([b-z])$/;

/** The board a variant hangs off: `erik-b` → `erik`, `hans-2` → `hans-2`. */
export function stripVariant(value: string): string {
  return value.replace(VARIANT_SUFFIX, "");
}

/**
 * The next free variant of a board — the name an edit lands under, so the rated
 * board keeps its own entry. Null once the letters run out.
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
 * Metrics and a score over a board. Solves with overshoot so the isolation
 * advisories are measured too — the seconds-long part, which is why the result
 * is persisted rather than re-derived on every page load.
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

/**
 * Whether a stored analysis no longer describes the board — because the board
 * moved under it, or the calibration it was measured under has been bumped.
 */
export function staleAnalysis(
  stored: Pick<Candidate, "board" | "scoring"> | null,
  board: Board,
): boolean {
  return !stored?.scoring ||
    stored.scoring.calibrationVersion !== CALIBRATION.version ||
    !isBoardSame(stored.board, board);
}

/**
 * Pure merge of a puzzle onto its stored entry. The board is the puzzle's; the
 * feedback, provenance, creation date and measured move count belong to the
 * entry and survive a draft that arrives with them zeroed or reset.
 */
export function mergeCandidate(
  puzzle: Puzzle,
  stored: Candidate | null,
  options: { source?: CandidateSource; analysis?: Analysis } = {},
): Candidate {
  const minMoves = options.analysis?.minMoves ?? stored?.minMoves ??
    puzzle.minMoves;

  return {
    ...puzzle,
    // Numbers are the corpus schedule; a candidate has none until promoted, and
    // the editor's empty board carries a `number: 0` worth dropping.
    number: puzzle.number || undefined,
    source: options.source ?? stored?.source ?? "generated",
    minMoves,
    // Labels already on disk were set by hand when there was a control for it;
    // they record where human judgement and move count disagreed, so they stay.
    difficulty: stored?.difficulty ?? difficultyForMoves(minMoves),
    createdAt: stored?.createdAt ?? puzzle.createdAt,
    rating: stored?.rating,
    reasons: stored?.reasons,
    note: stored?.note,
    solutionTags: stored?.solutionTags,
    genOptions: stored?.genOptions,
    generatorVersion: stored?.generatorVersion,
    promotedAs: stored?.promotedAs,
    scoring: options.analysis?.scoring ?? stored?.scoring,
  };
}

/**
 * The candidate for a board, analysed and on disk — the one entry point every
 * way into `/candidate` goes through. A corpus puzzle enters under its own slug
 * and name; a rating filed as "Untitled, 0 moves" is useless as ground truth.
 */
export async function upsertCandidate(
  puzzle: Puzzle,
  source?: CandidateSource,
): Promise<Candidate> {
  const stored = await readCandidate(puzzle.slug);
  const analysis = staleAnalysis(stored, puzzle.board)
    ? analyseBoard(puzzle.board)
    : undefined;

  const candidate = mergeCandidate(puzzle, stored, { source, analysis });
  await writeCandidate(candidate);
  return candidate;
}

/**
 * The candidate for a slug, brought up to date. A corpus entry is a copy, so
 * the shipped puzzle is re-read every visit: editing a board before release is
 * normal, and otherwise the copy — and the rating attached to it — would go on
 * describing a board that no longer ships.
 */
export async function currentCandidate(
  slug: string,
): Promise<Candidate | null> {
  const stored = await readCandidate(slug);
  if (!stored) return candidateForCorpusPuzzle(slug);

  if (candidateSource(stored) === "corpus") {
    const corpus = await getPuzzle(slug);
    // A corpus file that has since been deleted leaves the copy as the record.
    if (corpus) return upsertCandidate(corpus, "corpus");
  }

  return upsertCandidate(stored);
}

/**
 * The candidate for a corpus puzzle, created on first visit — what makes the
 * shipped corpus ratable alongside the generated boards.
 */
export async function candidateForCorpusPuzzle(
  slug: string,
): Promise<Candidate | null> {
  const puzzle = await getPuzzle(slug);
  if (!puzzle) return null;
  return upsertCandidate(puzzle, "corpus");
}

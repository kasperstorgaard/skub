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
  nextCandidateNumber,
  parseCandidate,
  type StoredScoring,
  stripVariant,
  toStoredScoring,
} from "#/game/candidates.ts";
import { getCorpusSlugs, getPuzzle } from "#/game/loader.ts";
import { pickUnusedName } from "#/game/names.ts";
import {
  CALIBRATION,
  computeMetrics,
  difficultyForMoves,
  scoreBoard,
} from "#/game/scoring.ts";
import { solveExhaustiveSync } from "#/game/solver.ts";
import { GENERATOR_VERSION } from "#/game/tiles.ts";
import type { Board, Puzzle, TilePlacement } from "#/game/types.ts";

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

/** The slug of every stored candidate. */
async function storedSlugs(): Promise<string[]> {
  return (await candidateFiles())
    .map((path) => path.slice(CANDIDATES_DIR.length + 1, -".md".length));
}

/**
 * Every stored candidate, parsed. A file that won't parse is skipped with a
 * warning — one hand-edit slip shouldn't take the whole list down.
 */
export async function readCandidates(): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const path of await candidateFiles()) {
    try {
      candidates.push(parseCandidate(await Deno.readTextFile(path)));
    } catch (err) {
      console.warn(`Skipping unparsable candidate ${path}`, err);
    }
  }
  return candidates;
}

/** A candidate's family: its base and every variant, base first. */
export async function readFamily(slug: string): Promise<Candidate[]> {
  const base = stripVariant(slug);
  const slugs = (await storedSlugs())
    .filter((other) => stripVariant(other) === base)
    // By slug, not path: `erik-b.md` sorts before `erik.md`.
    .toSorted((a, b) => a.localeCompare(b));

  const family = await Promise.all(slugs.map(readCandidate));
  return family.filter((candidate) => candidate !== null);
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
 * Slugs a candidate can't ship under: every corpus puzzle, and every other
 * family's base — a stored board there would claim the shipped puzzle's slot.
 */
export async function takenSlugs(slug: string): Promise<Set<string>> {
  const base = stripVariant(slug);
  const families = (await storedSlugs()).map(stripVariant)
    .filter((other) => other !== base);
  return new Set([...await getCorpusSlugs(), ...families]);
}

/** A pool name whose slug isn't taken, to offer when a board needs a name. */
export function suggestName(taken: Set<string>): string {
  const tried = new Set<string>();
  for (;;) {
    const name = pickUnusedName(tried);
    if (!taken.has(slugify(name))) return name;
    tried.add(name);
  }
}

/**
 * The next numbered slot for a board that has no name yet. Names are chosen at
 * promote time, so candidates never hold pool names against the corpus.
 */
export async function numberedCandidate(): Promise<
  { name: string; slug: string }
> {
  const slug = `candidate-${nextCandidateNumber(await storedSlugs())}`;
  return { name: slug, slug };
}

/**
 * BFS state budget for an analysis solve. Generous, but bounded: this one runs
 * inside a request, and a truncated advisory beats a page that hangs.
 */
const ANALYSIS_MAX_STATES = 4_000_000;

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
  options: {
    source?: CandidateSource;
    analysis?: Analysis;
    tiles?: TilePlacement[];
  } = {},
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
    // A board that arrives with its tiles was just composed from them; one
    // without keeps whatever the entry already recorded, and a board that never
    // had any carries no such key at all.
    ...(options.tiles ?? stored?.tiles
      ? { tiles: options.tiles ?? stored?.tiles }
      : {}),
    generatorVersion: options.tiles
      ? GENERATOR_VERSION
      : stored?.generatorVersion,
    promotedAs: stored?.promotedAs,
    scoring: options.analysis?.scoring ?? stored?.scoring,
  };
}

/**
 * The candidate for a board, analysed and on disk — the one entry point every
 * way into `/candidates` goes through. A corpus puzzle enters under its own slug
 * and name; a rating filed as "Untitled, 0 moves" is useless as ground truth.
 */
export async function upsertCandidate(
  puzzle: Puzzle,
  source?: CandidateSource,
  options: { tiles?: TilePlacement[] } = {},
): Promise<Candidate> {
  const stored = await readCandidate(puzzle.slug);
  const analysis = staleAnalysis(stored, puzzle.board)
    ? analyseBoard(puzzle.board)
    : undefined;

  const candidate = mergeCandidate(puzzle, stored, {
    source,
    analysis,
    tiles: options.tiles,
  });
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

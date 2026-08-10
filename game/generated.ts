import { formatPuzzle } from "#/game/formatter.ts";
import type { WallSpread } from "#/game/generator.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { CALIBRATION, type Metrics, type ScoredBoard } from "#/game/scoring.ts";
import { decodeMoves, encodeMoves } from "#/game/strings.ts";
import type { Difficulty, Move, Puzzle } from "#/game/types.ts";

/**
 * A generated puzzle candidate persisted to the `generated/` store for
 * curation. It's a `Puzzle` plus the human feedback that labels it and the
 * generation options that produced it — the raw material the
 * `compare-generated` script diffs against the hand-built corpus. Not a real
 * corpus puzzle: it never enters the manifest or the game until a curator
 * promotes it by hand into `static/puzzles`.
 */

/**
 * The candidate store, relative to the project root (cwd). Tracked in git — the
 * ratings here are the ground truth the scoring calibration is tuned against.
 * Kept out of `static/puzzles` so the manifest/corpus loader never picks
 * candidates up, and excluded from Vite's dev watcher (see vite.config.ts)
 * because the running app writes to it.
 */
export const GENERATED_DIR = "generated";

/**
 * Qualitative reasons a curator can tag a *board* with — how the layout looks
 * and sits, which is the only thing this level is asked to judge. Each maps
 * loosely to a board-scope metric the `compare-generated` report tests:
 * empty-areas → `emptyRegion`, clumped → `clumping`, pretty/ugly →
 * `wallSymmetry`. `ugly` is not just "not pretty": most boards are neither, so
 * a tag that only marks the good ones leaves the bad ones and the unremarkable
 * ones indistinguishable — which is the shape of correlation the metric needs.
 *
 * The list is deliberately short, and every word on it belongs to the board
 * alone. `too-easy` moved to the route level, where it's a concrete claim about
 * the solution a player would actually find (see {@link SOLUTION_TAGS});
 * `meh`/`nice` were dropped as vague and duplicated. Offering the same word at
 * both levels made it ambiguous which one a click was about. `too-hard` went
 * earlier — ~40 labeled candidates without a single use.
 */
export const REASON_TAGS = [
  { value: "clumped", label: "Clumped" },
  { value: "empty-areas", label: "Empty areas" },
  { value: "ugly", label: "Ugly" },
  { value: "pretty", label: "Pretty" },
] as const;

export type ReasonTag = typeof REASON_TAGS[number]["value"];

/**
 * Tags no longer offered at board level, but still on disk — including the
 * board-level `too-easy` labels written before it became a route tag. The
 * labelled store is the calibration ground truth, so a retired tag is kept and
 * round-tripped rather than stripped the next time a candidate is touched; it
 * just has no button.
 */
const RETIRED_REASON_TAGS = ["too-easy", "meh", "nice", "too-hard"] as const;

/** Tag values a feedback request may carry: current vocabulary plus history. */
export const REASON_TAG_VALUES: readonly string[] = [
  ...REASON_TAGS.map((t) => t.value),
  ...RETIRED_REASON_TAGS,
];

/**
 * The generator settings a candidate was produced with (provenance).
 * `difficulty` is historical — candidates generated before 0.7.0 were produced
 * against a difficulty band; generation now targets an exact move count and the
 * curator judges difficulty afterwards (see `Feedback.difficulty`).
 */
export type GenOptions = {
  wallsRange: [number, number];
  blockersRange: [number, number];
  wallSpread: WallSpread;
  symmetry: number;
  difficulty?: Difficulty;
  /** Exact minMoves the run was after. Absent on pre-0.7.0 candidates. */
  targetMoves?: number;
};

/**
 * What a curator can say about a single solution, as opposed to the board it
 * belongs to. Four words, and no rating: the star rating is a puzzle-level
 * verdict, and a second scale per route would only make "what am I rating?"
 * ambiguous on every click. A route gets labelled, not scored.
 *
 * `too-easy` is the important one. Difficulty is a property of the route a
 * player actually finds, not of the board — the obvious route is the one they
 * take, and a board whose easiest solution is trivial plays trivially however
 * good the others are. Measured against the board it was ambiguous (too easy
 * *for whom*, by which route?), which is why it never correlated; against a
 * single route it's a concrete claim.
 *
 * `boring` is the other half: a route that isn't easy but isn't worth finding
 * either.
 *
 * The two positives are separate on purpose, because they fail separately.
 * `interesting` is about the route as an experience — it does something worth
 * discovering (the composite, `deception`, `reversals`). `unique` is about it
 * being genuinely its own route rather than a reshuffle of another one, which
 * `puckPathVariety` measures: the `birk` case had two 9-move solutions moving
 * the puck along the same path, differing only in the order the blockers got
 * shuffled — reported as two solutions, experienced as one. A route can be
 * interesting without being unique, and unique without being interesting.
 *
 * All four are labels a route-level score can be calibrated against — a route
 * tagged too-easy that the composite scores well is exactly the disagreement
 * worth having on record.
 */
export const SOLUTION_TAGS = [
  { value: "too-easy", label: "Too easy" },
  { value: "boring", label: "Boring" },
  { value: "interesting", label: "Interesting" },
  { value: "unique", label: "Unique" },
] as const;

export type SolutionTag = typeof SOLUTION_TAGS[number]["value"];

/** Valid solution-tag values, for request validation. */
export const SOLUTION_TAG_VALUES: readonly SolutionTag[] = SOLUTION_TAGS.map((
  t,
) => t.value);

/** Human feedback on a candidate. All optional — a fresh candidate is unrated. */
export type Feedback = {
  /** 0.5–5 quality rating in half-star steps; absent until the curator rates it. */
  rating?: number;
  reasons?: ReasonTag[];
  note?: string;
  /**
   * The curator's difficulty call, made after seeing the board rather than
   * chosen up front. Seeded from the move count (`difficultyForMoves`), then
   * overridden by hand — the override is the signal worth having, since it's
   * where human judgement and move count disagree.
   */
  difficulty?: Difficulty;
  /**
   * Per-route tags, keyed by the route's encoded moves. Keyed by moves rather
   * than by index so a label still points at the route it was written about if
   * the solutions are ever re-enumerated in a different order.
   */
  solutionTags?: Record<string, SolutionTag[]>;
};

/**
 * One distinct optimal solution as stored: its moves in chess notation (the
 * same encoding the board URLs use, so a stored route is a link away from being
 * replayed) plus everything that was measured about it.
 */
export type StoredSolution = {
  moves: string;
  score: number;
  metrics: Metrics;
};

/**
 * The full scoring readout for a candidate, written at generation time so it
 * can be read back without re-solving. A gate solve costs seconds; the store is
 * the only place the result survives a page load, and re-deriving it on every
 * navigation is what would otherwise force the curation UI to hold its state in
 * memory and lose it on any link.
 *
 * Verbose on purpose — every route's every metric. These files are a dev-only
 * record whose whole job is to be the raw material for calibration, so
 * completeness beats brevity; the calibration scripts read the metrics from
 * here instead of solving the corpus again.
 */
export type StoredScoring = {
  /** Composite for the board — the mean across routes. */
  score: number;
  mean: number;
  /** Worst single route, the outlier detector. */
  min: number;
  stddev: number;
  /**
   * Board-level view of every metric, reduced across routes the way the
   * composite reduces them (see `METRIC_CATALOG.aggregate`). Route-scope
   * entries here are that reduction, not a value any single route has.
   */
  metrics: Metrics;
  /** Every distinct optimal solution, in enumeration order. */
  solutions: StoredSolution[];
  /** Calibration the scores were computed under — they're stale across a bump. */
  calibrationVersion: string;
};

export type GeneratedCandidate = Puzzle & Feedback & {
  genOptions?: GenOptions;
  /** Generator algorithm version that produced this board (e.g. "0.5"). */
  generatorVersion?: string;
  /** Scores and metrics as measured at generation time. */
  scoring?: StoredScoring;
};

/** Rounds a stored number to something a human can read in a diff. */
const round = (value: number): number => Math.round(value * 1e4) / 1e4;

const roundMetrics = (metrics: Metrics): Metrics => {
  const out = {} as Metrics;
  for (const [key, value] of Object.entries(metrics)) {
    out[key as keyof Metrics] = round(value);
  }
  return out;
};

/** Packs a scored board into its stored form. */
export function toStoredScoring(
  scored: ScoredBoard,
  metrics: Metrics,
): StoredScoring {
  return {
    score: round(scored.score),
    mean: round(scored.mean),
    min: round(scored.min),
    stddev: round(scored.stddev),
    metrics: roundMetrics(metrics),
    solutions: scored.perSolution.map((solution) => ({
      moves: encodeMoves(solution.moves),
      score: round(solution.score),
      metrics: roundMetrics(solution.metrics),
    })),
    calibrationVersion: CALIBRATION.version,
  };
}

/** The solutions of a stored scoring, with their moves decoded. */
export function storedSolutionMoves(scoring: StoredScoring): Move[][] {
  return scoring.solutions.map((solution) => decodeMoves(solution.moves));
}

/** How the UI references a stored candidate: identity plus its feedback. */
export type StoredCandidate = Feedback & { slug: string; name: string };

/**
 * Serializes a candidate to markdown. `formatPuzzle` stringifies every metadata
 * key it's given, so the feedback and `genOptions` fields round-trip through the
 * frontmatter alongside the standard puzzle metadata.
 */
export function formatGenerated(candidate: GeneratedCandidate): string {
  return formatPuzzle(candidate);
}

/** Parses a stored candidate back, feedback and provenance included. */
export function parseGenerated(markdown: string): GeneratedCandidate {
  return parsePuzzle(markdown) as GeneratedCandidate;
}

import type { Metrics } from "#/game/scoring.ts";

/**
 * What each metric in `Metrics` means, how it reduces across a board's routes,
 * and how to show it. Everything that lists metrics reads this catalog — the
 * generator panel's readout, the corpus and comparison reports, and the
 * calibration tooling — so adding a metric is one edit here rather than five
 * hand-maintained lists that silently drift apart.
 *
 * `aggregate` mirrors `computeMetrics`' reduction: `max` across routes for
 * signals, `min` for the penalties (metrics measured once per board are
 * route-constant, so `max` is a no-op on them).
 */
export type MetricSpec = {
  key: keyof Metrics;
  /** Short label for the generator panel. */
  label: string;
  /** One-line explanation, shown as a tooltip. */
  hint: string;
  aggregate: "max" | "min";
  /** Rendered as a percentage rather than a raw number. */
  percent?: boolean;
  /** Rendered as an integer (counts, not scores). */
  whole?: boolean;
};

export const METRIC_CATALOG = [
  {
    key: "stopWeighted",
    label: "Stops (wtd)",
    hint: "Weighted count of how slides stop: piece×3 + wall×2 + edge.",
    aggregate: "max",
  },
  {
    key: "pieceUsage",
    label: "Piece usage",
    hint:
      "Log-weighted blocker involvement — sums each blocker's moves and stops; grows with reuse, so it can exceed the piece count (not a count).",
    aggregate: "max",
  },
  {
    key: "wallUtilization",
    label: "Wall use",
    hint:
      "Share of interior walls that ever stop a piece across solutions (gate G7).",
    aggregate: "max",
    percent: true,
  },
  {
    key: "reversals",
    label: "Reversals",
    hint: "Moves of the same piece in opposite directions (back-and-forth).",
    aggregate: "max",
  },
  {
    key: "searchProfile",
    label: "Search",
    hint:
      "Share of search states reached near the solution depth (back-loaded difficulty).",
    aggregate: "max",
  },
  {
    key: "clumping",
    label: "Clumping",
    hint:
      "Share of wall/blocker pairs bunched within one cell of each other (the 'clumped' complaint).",
    aggregate: "max",
    percent: true,
  },
  {
    key: "pointlessClearance",
    label: "Pointless",
    hint:
      "Blocker moves after which that blocker never matters again (negative signal).",
    aggregate: "min",
  },
  {
    key: "sameDirectionRepeat",
    label: "Same dir",
    hint: "Cells a piece re-traverses in the same direction (negative signal).",
    aggregate: "min",
  },
  {
    key: "uniqueSolutions",
    label: "Solutions",
    hint: "Number of distinct optimal solutions.",
    aggregate: "max",
    whole: true,
  },
  {
    key: "puckPathVariety",
    label: "Puck variety",
    hint:
      "Distinct puck trajectories ÷ distinct solutions. 100% means every solution moves the puck differently; low means the extra routes are the same puck path with the setup reshuffled.",
    aggregate: "max",
    percent: true,
  },
  {
    key: "openingSetup",
    label: "Opening setup",
    hint:
      "Moves before the puck first moves, in the solution that gets going soonest. 0 means the puck opens; higher means the puzzle starts with blocker admin.",
    aggregate: "min",
  },
  {
    key: "deadSpace",
    label: "Dead space",
    hint:
      "Share of cells no trail enters and no piece or goal occupies (gate G8).",
    aggregate: "max",
    percent: true,
  },
  {
    key: "coverage",
    label: "Coverage",
    hint: "Distinct cells the puck sweeps, as a fraction of the 64 cells.",
    aggregate: "max",
  },
  {
    key: "setupRatio",
    label: "Setup ratio",
    hint:
      "Fraction of moves that reposition a blocker rather than the puck (more setup ⇒ harder).",
    aggregate: "max",
  },
  {
    key: "deception",
    label: "Deception",
    hint:
      "How far the puck slides away from the goal — what misleads a solver.",
    aggregate: "max",
  },
  {
    key: "crossTrailOverlap",
    label: "Cross-trail",
    hint: "How much one piece's path crosses another's.",
    aggregate: "max",
  },
  {
    key: "totalDistance",
    label: "Distance",
    hint: "Total slide distance travelled (puck + blocker).",
    aggregate: "max",
  },
  {
    key: "firstMovePrecision",
    label: "First move",
    hint: "1 / distinct optimal openings — 1 when the first move is forced.",
    aggregate: "max",
  },
  {
    key: "isolationGap",
    label: "Isolation",
    hint:
      "Moves past optimal to the nearest genuine near-miss — 2 means the optimal route stands alone at +1 (torstein profile); 1 means a real alternative sits right behind it (0 = not measured).",
    aggregate: "max",
    whole: true,
  },
  {
    key: "nearMissCount",
    label: "Near misses",
    hint:
      "Count of genuine alternative solutions at optimal + 1 (padded routes — an optimal path plus one idle move — excluded). Higher means being a move sloppy still finds a real route.",
    aggregate: "max",
    whole: true,
  },
] as const satisfies readonly MetricSpec[];

/**
 * Compile-time completeness check: adding a metric to `Metrics` without a
 * catalog entry is a type error here, naming the missing key. This is what
 * stops the report and panel lists from drifting — a hand-maintained copy once
 * silently NaN'd a whole calibration run.
 */
type Assert<T extends true> = T;
type _CatalogIsComplete = Assert<
  Exclude<keyof Metrics, typeof METRIC_CATALOG[number]["key"]> extends never
    ? true
    : false
>;

export const METRIC_KEYS: readonly (keyof Metrics)[] = METRIC_CATALOG.map((
  spec,
) => spec.key);

/**
 * Reduces per-route metrics to one value per metric, using each metric's
 * catalogued direction. Mirrors `computeMetrics` for consumers that hold raw
 * route metrics (e.g. the calibration cache).
 */
export function aggregateMetrics(routes: Metrics[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { key, aggregate } of METRIC_CATALOG) {
    let value = aggregate === "max" ? -Infinity : Infinity;
    for (const route of routes) value = Math[aggregate](value, route[key]);
    out[key] = value;
  }
  return out;
}

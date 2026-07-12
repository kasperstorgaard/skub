/**
 * Scores every puzzle in static/puzzles and writes a markdown report: one row per
 * puzzle, with the mean and min (worst route) of each metric across that puzzle's
 * distinct solutions, plus the composite score / worst route. The worst-route
 * outliers (boards a `min`-score curation filter would reject) are listed first.
 *
 * Usage: `deno task score-corpus [outfile] [--floor=0.5]`
 * Defaults to writing `corpus-score.md`.
 */
import { parsePuzzle } from "#/game/parser.ts";
import { solveExhaustiveSync } from "#/game/solver.ts";
import { type Metrics, scoreBoard } from "#/game/scoring.ts";

const PUZZLE_DIR = "static/puzzles";
const outFile = Deno.args.find((a) => !a.startsWith("--")) ?? "corpus-score.md";
const floor = Number(
  Deno.args.find((a) => a.startsWith("--floor="))?.slice("--floor=".length) ??
    "0.5",
);
// Restrict to a single puzzle by slug — useful while the hard-puzzle enumeration
// blowup is unresolved (a large raw optimal-solution set can OOM the process).
const only = Deno.args.find((a) => a.startsWith("--only="))?.slice(
  "--only=".length,
);

/** Slugs reviewed and accepted despite a low worst route — kept out of outliers. */
async function loadExcludes(): Promise<Set<string>> {
  try {
    const text = await Deno.readTextFile("scripts/corpus-excludes.txt");
    return new Set(
      text.split("\n").map((l) => l.trim()).filter((l) =>
        l !== "" && !l.startsWith("#")
      ),
    );
  } catch {
    return new Set();
  }
}
const excludes = await loadExcludes();

/** The scalar metrics reported per puzzle, in column order. */
const METRICS = [
  "setupRatio",
  "pieceUsage",
  "deception",
  "reversals",
  "crossTrailOverlap",
  "totalDistance",
  "coverage",
  "firstMovePrecision",
  "searchProfile",
  "uniqueSolutions",
  "stopWeighted",
  "pointlessClearance",
  "sameDirectionRepeat",
] as const;

function scalarMetrics(m: Metrics): Record<string, number> {
  return {
    setupRatio: m.setupRatio,
    pieceUsage: m.pieceUsage,
    deception: m.deception,
    reversals: m.reversals,
    crossTrailOverlap: m.crossTrailOverlap,
    totalDistance: m.totalDistance.puck + m.totalDistance.blocker,
    coverage: m.coverage,
    firstMovePrecision: m.firstMovePrecision,
    searchProfile: m.searchProfile,
    uniqueSolutions: m.uniqueSolutions,
    stopWeighted: m.stopTypes.piece * 3 + m.stopTypes.wall * 2 +
      m.stopTypes.edge,
    pointlessClearance: m.pointlessClearance,
    sameDirectionRepeat: m.sameDirectionRepeat,
  };
}

const f = (n: number) => n.toFixed(3);

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

type PuzzleRow = {
  slug: string;
  difficulty: string;
  minMoves: number;
  routes: number;
  score: number;
  worst: number;
  /** metric → { mean, min } across the puzzle's routes */
  metrics: Record<string, { mean: number; min: number }>;
};

const rows: PuzzleRow[] = [];
let skipped = 0;

for await (const entry of Deno.readDir(PUZZLE_DIR)) {
  if (!entry.name.endsWith(".md")) continue;
  const content = await Deno.readTextFile(`${PUZZLE_DIR}/${entry.name}`);

  let puzzle;
  try {
    puzzle = parsePuzzle(content);
  } catch {
    skipped++;
    continue;
  }
  if (only && puzzle.slug !== only) continue;

  let scored;
  try {
    scored = scoreBoard(puzzle.board, solveExhaustiveSync(puzzle.board));
  } catch (err) {
    console.error(`skip ${puzzle.slug}: ${(err as Error).message}`);
    skipped++;
    continue;
  }

  const perRoute = scored.perSolution.map((s) => scalarMetrics(s.metrics));
  const metrics: PuzzleRow["metrics"] = {};
  for (const name of METRICS) {
    const values = perRoute.map((r) => r[name]);
    metrics[name] = {
      mean: values.reduce((a, b) => a + b, 0) / (values.length || 1),
      min: values.length ? Math.min(...values) : 0,
    };
  }

  rows.push({
    slug: puzzle.slug,
    difficulty: puzzle.difficulty,
    minMoves: puzzle.minMoves,
    routes: scored.perSolution.length,
    score: scored.score,
    worst: scored.min,
    metrics,
  });
}

// Stable slug ordering so tuning re-runs diff cleanly — only cell values change,
// rows never move. (Sort in a viewer if you want a ranked view.)
rows.sort((a, b) => a.slug.localeCompare(b.slug));
const outliers = rows.filter((r) => r.worst < floor && !excludes.has(r.slug));

const headers = [
  "slug",
  "diff",
  "mM",
  "routes",
  "score",
  "worst",
  ...METRICS.map((m) => `${m} (mean/min)`),
];

const toRow = (r: PuzzleRow): string[] => [
  r.slug,
  r.difficulty,
  String(r.minMoves),
  String(r.routes),
  f(r.score),
  f(r.worst),
  ...METRICS.map((m) => `${f(r.metrics[m].mean)}/${f(r.metrics[m].min)}`),
];

const md = [
  `# Corpus score report`,
  ``,
  `${rows.length} puzzles, ${skipped} skipped.`,
  `Each metric cell is \`mean/min\` across the puzzle's distinct solutions;`,
  `\`score\` is the mean route score, \`worst\` the lowest route. Rows are sorted`,
  `by slug so tuning re-runs produce clean value-only diffs.`,
  ``,
  `## Outliers — worst route below ${floor}, excluding ${excludes.size} listed (${outliers.length})`,
  ``,
  outliers.length === 0 ? `_none_` : table(headers, outliers.map(toRow)),
  ``,
  `## All puzzles`,
  ``,
  table(headers, rows.map(toRow)),
  ``,
].join("\n");

await Deno.writeTextFile(outFile, md);
console.log(
  `Scored ${rows.length} puzzles (${skipped} skipped, ${outliers.length} outliers < ${floor}) → ${outFile}`,
);

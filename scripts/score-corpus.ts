/**
 * Scores every puzzle in static/puzzles and writes a markdown report: one row per
 * puzzle, with the mean and min (worst route) of each metric across that puzzle's
 * distinct solutions, plus the composite score / worst route.
 *
 * Each puzzle is scored in its own subprocess, so a pathologically branchy board
 * whose raw optimal-solution set OOMs only crashes its own worker — the
 * orchestrator sees a non-zero exit and skips it (listed under "Skipped").
 *
 * Usage: `deno task score-corpus [outfile] [--floor=0.5] [--only=<slug>] [--timeout=30000]`
 * Defaults to writing `corpus-score.md`.
 */
import { parsePuzzle } from "#/game/parser.ts";
import { solveExhaustiveSync } from "#/game/solver.ts";
import { type Metrics, scoreBoard } from "#/game/scoring.ts";

const PUZZLE_DIR = "static/puzzles";
const flag = (name: string) =>
  Deno.args.find((a) => a.startsWith(name))?.slice(name.length);

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

/** Worker mode: score one puzzle file and emit its row as JSON on stdout. */
function scoreFile(path: string): PuzzleRow {
  const puzzle = parsePuzzle(Deno.readTextFileSync(path));
  const scored = scoreBoard(puzzle.board, solveExhaustiveSync(puzzle.board));

  const perRoute = scored.perSolution.map((s) => scalarMetrics(s.metrics));
  const metrics: PuzzleRow["metrics"] = {};
  for (const name of METRICS) {
    const values = perRoute.map((r) => r[name]);
    metrics[name] = {
      mean: values.reduce((a, b) => a + b, 0) / (values.length || 1),
      min: values.length ? Math.min(...values) : 0,
    };
  }

  return {
    slug: puzzle.slug,
    difficulty: puzzle.difficulty,
    minMoves: puzzle.minMoves,
    routes: scored.perSolution.length,
    score: scored.score,
    worst: scored.min,
    metrics,
  };
}

const workerFile = flag("--file=");
if (workerFile) {
  // Any failure (parse error, solver limit, OOM) exits non-zero → parent skips.
  console.log(JSON.stringify(scoreFile(workerFile)));
  Deno.exit(0);
}

// ---- orchestrator ----

const outFile = Deno.args.find((a) => !a.startsWith("--")) ?? "corpus-score.md";
const floor = Number(flag("--floor=") ?? "0.5");
const only = flag("--only=");
const timeoutMs = Number(flag("--timeout=") ?? "30000");

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

/** Scores one puzzle file in a subprocess; null if it crashed or timed out. */
async function scoreInSubprocess(path: string): Promise<PuzzleRow | null> {
  try {
    const { code, stdout } = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "scripts/score-corpus.ts", `--file=${path}`],
      stdout: "piped",
      stderr: "null",
      signal: AbortSignal.timeout(timeoutMs),
    }).output();
    if (code !== 0) return null;
    return JSON.parse(new TextDecoder().decode(stdout)) as PuzzleRow;
  } catch {
    return null;
  }
}

const rows: PuzzleRow[] = [];
const skipped: string[] = [];

for await (const entry of Deno.readDir(PUZZLE_DIR)) {
  if (!entry.name.endsWith(".md")) continue;
  if (only && entry.name !== `${only}.md`) continue;
  const row = await scoreInSubprocess(`${PUZZLE_DIR}/${entry.name}`);
  if (row) rows.push(row);
  else skipped.push(entry.name.replace(/\.md$/, ""));
}

rows.sort((a, b) => a.slug.localeCompare(b.slug));
skipped.sort((a, b) => a.localeCompare(b));
const outliers = rows.filter((r) => r.worst < floor && !excludes.has(r.slug));

const f = (n: number) => n.toFixed(3);

function table(headers: string[], tableRows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...tableRows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

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
  `${rows.length} scored, ${skipped.length} skipped.`,
  `Each metric cell is \`mean/min\` across the puzzle's distinct solutions;`,
  `\`score\` is the mean route score, \`worst\` the lowest route. Rows are sorted`,
  `by slug so tuning re-runs produce clean value-only diffs.`,
  ``,
  `## Skipped — too branchy to score exhaustively (${skipped.length})`,
  ``,
  skipped.length === 0 ? `_none_` : skipped.map((s) => `- ${s}`).join("\n"),
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
  `Scored ${rows.length} puzzles (${skipped.length} skipped, ${outliers.length} outliers < ${floor}) → ${outFile}`,
);

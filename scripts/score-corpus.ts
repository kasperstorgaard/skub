/**
 * Scores every puzzle in `static/puzzles` and writes a markdown report: one row
 * per puzzle with each metric's mean and min across its distinct solutions, the
 * composite score and worst route, plus the slowest boards and any whose worst
 * route falls below `--floor` (the outlier list curation works from).
 *
 * Usage: `deno task score-corpus [outfile] [--floor=0.5] [--timeout=30000]`
 */
import { METRIC_CATALOG } from "#/game/metric-catalog.ts";
import { CALIBRATION, type Metrics } from "#/game/scoring.ts";
import {
  boardScore,
  flag,
  solveDir,
  worstRoute,
} from "#/scripts/lib/boards.ts";
import { f, table, writeReport } from "#/scripts/lib/report.ts";
import type { SolvedBoard } from "#/scripts/lib/score-worker.ts";

const outFile = Deno.args.find((arg) => !arg.startsWith("--")) ??
  `scoring/reports/calibration-${CALIBRATION.version}.md`;
const floor = Number(flag("--floor=") ?? "0.5");
const timeoutMs = Number(flag("--timeout=") ?? "30000");

/** Slugs allowed to sit below the floor without being flagged. */
async function loadExcludes(): Promise<Set<string>> {
  try {
    const text = await Deno.readTextFile("scripts/corpus-excludes.txt");
    return new Set(
      text.split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#")),
    );
  } catch {
    return new Set();
  }
}

const excludes = await loadExcludes();
const { boards, skipped } = await solveDir("static/puzzles", {
  timeoutMs,
  onProgress: (slug) => console.log(`solving ${slug}…`),
});

type Row = { slug: string; board: SolvedBoard; score: number; worst: number };

const rows: Row[] = [...boards.entries()]
  .map(([slug, board]) => ({
    slug,
    board,
    score: boardScore(board),
    worst: worstRoute(board),
  }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

/** `mean/min` of one metric across a board's routes. */
function metricCell(board: SolvedBoard, key: keyof Metrics): string {
  const values = board.routes.map((route) => route[key]);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  return `${f(average)}/${f(Math.min(...values))}`;
}

const headers = [
  "slug",
  "diff",
  "mM",
  "routes",
  "ms",
  "score",
  "worst",
  ...METRIC_CATALOG.map((metric) => `${metric.key} (mean/min)`),
];

const toRow = ({ slug, board, score, worst }: Row): string[] => [
  slug,
  board.difficulty,
  String(board.minMoves),
  String(board.routes.length),
  String(board.ms),
  f(score),
  f(worst),
  ...METRIC_CATALOG.map((metric) => metricCell(board, metric.key)),
];

const scores = rows.map((row) => row.score).sort((a, b) => a - b);
const distribution = scores.length === 0 ? "n/a" : [
  `min ${f(scores[0])}`,
  `median ${f(scores[Math.floor(scores.length / 2)])}`,
  `mean ${f(scores.reduce((sum, s) => sum + s, 0) / scores.length)}`,
  `max ${f(scores.at(-1)!)}`,
].join(", ");

const outliers = rows.filter((row) =>
  row.worst < floor && !excludes.has(row.slug)
);
const slowest = [...rows].sort((a, b) => b.board.ms - a.board.ms).slice(0, 10);

await writeReport(
  outFile,
  `# Corpus score report

**Calibration v${CALIBRATION.version}** — ${rows.length} scored, ${skipped.length} skipped.
Score distribution: ${distribution}.

Each metric cell is \`mean/min\` across the puzzle's distinct solutions;
\`score\` is the mean route score, \`worst\` the lowest route, \`ms\` the
solve+score time. Rows are sorted by slug so tuning re-runs diff cleanly.

## Slowest puzzles (top 10 by ms)

${
    slowest.length === 0
      ? "_none_"
      : slowest.map((row) =>
        `- ${row.slug} — ${row.board.ms} ms (${row.board.minMoves} moves, ${row.board.routes.length} routes)`
      ).join("\n")
  }

## Skipped — too branchy to score exhaustively (${skipped.length})

${
    skipped.length === 0
      ? "_none_"
      : skipped.map((slug) => `- ${slug}`).join("\n")
  }

## Outliers — worst route below ${floor}, excluding ${excludes.size} listed (${outliers.length})

${outliers.length === 0 ? "_none_" : table(headers, outliers.map(toRow))}

## All puzzles

${table(headers, rows.map(toRow))}
`,
);

console.log(
  `Scored ${rows.length} puzzles (${skipped.length} skipped, ${outliers.length} outliers < ${floor}) → ${outFile}`,
);

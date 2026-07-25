/**
 * Diffs the labeled generator candidates against the hand-built corpus, to see
 * which metrics actually separate the boards a human kept from the ones they
 * rejected — the evidence for promoting an advisory metric into the composite.
 *
 * Usage: `deno task compare-generated [outfile] [--timeout=30000]`
 */
import {
  GENERATED_DIR,
  parseGenerated,
  type ReasonTag,
} from "#/game/generated.ts";
import { aggregateMetrics, METRIC_CATALOG } from "#/game/metric-catalog.ts";
import { CALIBRATION } from "#/game/scoring.ts";
import {
  boardScore,
  flag,
  solveDir,
  worstRoute,
} from "#/scripts/lib/boards.ts";
import {
  f,
  mean,
  quantiles,
  table,
  writeReport,
} from "#/scripts/lib/report.ts";
import type { SolvedBoard } from "#/scripts/lib/score-worker.ts";

const outFile = Deno.args.find((arg) => !arg.startsWith("--")) ??
  "scoring/reports/generated-vs-corpus.md";
const timeoutMs = Number(flag("--timeout=") ?? "30000");

/** Report columns: the composite headline, then every catalogued metric. */
const COLUMNS = ["score", "worst", ...METRIC_CATALOG.map((m) => m.key)];

const columnValues = (board: SolvedBoard): Record<string, number> => ({
  score: boardScore(board),
  worst: worstRoute(board),
  ...aggregateMetrics(board.routes),
});

const onProgress = (slug: string) => console.log(`solving ${slug}…`);
const corpus = await solveDir("static/puzzles", { timeoutMs, onProgress });
const generated = await solveDir(GENERATED_DIR, { timeoutMs, onProgress });

const corpusRows = [...corpus.boards.values()].map(columnValues);
const high: Record<string, number>[] = [];
const low: Record<string, number>[] = [];
const byReason = new Map<ReasonTag, Record<string, number>[]>();

for (const [slug, board] of generated.boards) {
  const stored = parseGenerated(
    await Deno.readTextFile(`${GENERATED_DIR}/${slug}.md`),
  );
  const values = columnValues(board);

  if (stored.rating !== undefined && stored.rating >= 4) high.push(values);
  if (stored.rating !== undefined && stored.rating <= 2) low.push(values);
  for (const reason of stored.reasons ?? []) {
    byReason.set(reason, [...(byReason.get(reason) ?? []), values]);
  }
}

const column = (rows: Record<string, number>[], key: string) =>
  rows.map((row) => row[key]);

const distributions = table(
  ["metric", "corpus (min/med/max)", "high-rated", "low-rated"],
  COLUMNS.map((key) => [
    key,
    quantiles(column(corpusRows, key)),
    quantiles(column(high, key)),
    quantiles(column(low, key)),
  ]),
);

const reasonRows = [...byReason.entries()].map(([reason, rows]) => [
  reason,
  String(rows.length),
  ...COLUMNS.map((key) => f(mean(column(rows, key)))),
]);

await writeReport(
  outFile,
  `# Generated vs corpus

Corpus: ${corpusRows.length} scored. Generated: ${generated.boards.size} scored, \
${high.length} high-rated (4–5), ${low.length} low-rated (1–2).

All boards scored at calibration \`v${CALIBRATION.version}\`. The question this
answers: which metrics separate the boards a human kept from the ones they
rejected — i.e. which advisory signals are worth promoting.

## Metric distributions (min / median / max)

${distributions}

## Per-reason-tag metric means

${
    reasonRows.length
      ? table(["reason", "n", ...COLUMNS], reasonRows)
      : "_no tagged candidates yet_"
  }
`,
);

console.log(
  `Compared ${generated.boards.size} generated vs ${corpusRows.length} corpus → ${outFile}`,
);

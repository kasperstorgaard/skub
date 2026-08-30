/**
 * Measures how well the scoring composite tracks human judgement: scores every
 * rated candidate in the store and reports the Spearman correlation between
 * ratings and composite scores, the ordered table (so misplaced boards are
 * visible), and per-metric ρ — the evidence base for promoting or demoting
 * composite terms.
 *
 * The anchors are no longer four hardcoded ratings: a corpus puzzle rated
 * through `/candidate` is a stored candidate like any other, tagged
 * `source: corpus`, so the shipped boards — the ones that represent "good" —
 * carry their ground truth in the same place as the generated ones.
 *
 * It also answers what `compare-generated` used to: which metrics separate the
 * boards a human kept from the ones they rejected. That's a rating-separation
 * question, so it lives here; the tables go to a report file, since they're too
 * wide to read in a terminal.
 *
 * Run after any `CALIBRATION` change. Solves are cached and
 * calibration-independent, so iterations cost seconds.
 *
 * Usage: `deno task check-anchors [outfile] [--timeout=60000]`
 */
import {
  type Candidate,
  CANDIDATES_DIR,
  type CandidateSource,
  candidateSource,
  parseCandidate,
  type ReasonTag,
} from "#/game/candidates.ts";
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
  spearman,
  table,
  writeReport,
} from "#/scripts/lib/report.ts";
import type { SolvedBoard } from "#/scripts/lib/score-worker.ts";

const outFile = Deno.args.find((arg) => !arg.startsWith("--")) ??
  `scoring/reports/rating-separation-v${CALIBRATION.version}.md`;
const timeoutMs = Number(flag("--timeout=") ?? "60000");

type Row = {
  name: string;
  rating: number;
  score: number;
  source: CandidateSource;
  stored: Candidate;
  board: SolvedBoard;
  /** Every reported column for this board, so subsets can be sliced by key. */
  values: Record<string, number>;
};

/** Report columns: the composite headline, then every catalogued metric. */
const COLUMNS = ["score", "worst", ...METRIC_CATALOG.map((m) => m.key)];

const columnValues = (board: SolvedBoard): Record<string, number> => ({
  score: boardScore(board),
  worst: worstRoute(board),
  ...aggregateMetrics(board.routes),
});

const candidates = await solveDir(CANDIDATES_DIR, {
  timeoutMs,
  onProgress: (slug) => console.log(`solving ${slug}…`),
});

const rows: Row[] = [];
for (const [slug, board] of candidates.boards) {
  const stored = parseCandidate(
    await Deno.readTextFile(`${CANDIDATES_DIR}/${slug}.md`),
  );
  // Unrated candidates carry no ground truth.
  if (stored.rating === undefined) continue;
  rows.push({
    name: stored.name,
    rating: stored.rating,
    score: boardScore(board),
    source: candidateSource(stored),
    stored,
    board,
    values: columnValues(board),
  });
}

if (rows.length === 0) {
  console.log(
    "\nNothing rated yet — rate boards at /candidate (a corpus puzzle gets " +
      "there from its own page).",
  );
  Deno.exit(0);
}

rows.sort((a, b) => b.score - a.score);

const corpusRows = rows.filter((row) => row.source === "corpus");

console.log(`\nCalibration v${CALIBRATION.version} vs human judgement\n`);
console.log("score  ★  name");
console.log("-".repeat(34));
for (const row of rows) {
  const anchor = row.source === "corpus" ? " (corpus)" : "";
  console.log(`${row.score.toFixed(3)}  ${row.rating}  ${row.name}${anchor}`);
}

const ratings = rows.map((row) => row.rating);
const rho = spearman(ratings, rows.map((row) => row.score));

console.log(
  `\nSpearman ρ = ${rho.toFixed(3)} over ${rows.length} rated boards ` +
    `(${corpusRows.length} corpus + ${
      rows.length - corpusRows.length
    } generated)` +
    (candidates.skipped.length
      ? `; skipped: ${candidates.skipped.join(", ")}`
      : ""),
);
console.log(
  "Target: ρ → +1. The table above shows which boards sit out of order.",
);

const inComposite = new Set([
  ...Object.keys(CALIBRATION.positive),
  ...Object.keys(CALIBRATION.negative),
]);

const aggregated = rows.map((row) => aggregateMetrics(row.board.routes));
const metricRhos = METRIC_CATALOG
  .map(({ key }) => ({
    key,
    rho: spearman(ratings, aggregated.map((metrics) => metrics[key])),
  }))
  .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

console.log("\nPer-metric ρ vs rating (composite terms marked ●):\n");
for (const { key, rho: value } of metricRhos) {
  const mark = inComposite.has(key) ? "●" : " ";
  const sign = value >= 0 ? "+" : "-";
  const bar = "█".repeat(Math.round(Math.abs(value) * 20));
  console.log(
    `${mark} ${key.padEnd(20)} ${sign}${Math.abs(value).toFixed(3)}  ${bar}`,
  );
}

const column = (subset: Row[], key: string) =>
  subset.map((row) => row.values[key]);

const high = rows.filter((row) => row.rating >= 4);
const low = rows.filter((row) => row.rating <= 2);

const byReason = new Map<ReasonTag, Row[]>();
for (const row of rows) {
  for (const reason of row.stored.reasons ?? []) {
    byReason.set(reason, [...(byReason.get(reason) ?? []), row]);
  }
}

const distributions = table(
  ["metric", "corpus (min/med/max)", "high-rated", "low-rated"],
  COLUMNS.map((key) => [
    key,
    quantiles(column(corpusRows, key)),
    quantiles(column(high, key)),
    quantiles(column(low, key)),
  ]),
);

const reasonRows = [...byReason.entries()].map(([reason, subset]) => [
  reason,
  String(subset.length),
  ...COLUMNS.map((key) => f(mean(column(subset, key)))),
]);

await writeReport(
  outFile,
  `# Rating separation

${rows.length} rated boards — ${corpusRows.length} corpus, ${
    rows.length - corpusRows.length
  } generated; \
${high.length} high-rated (4–5), ${low.length} low-rated (1–2).
Spearman ρ = ${f(rho)} between rating and composite.

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

console.log(`\nSeparation tables → ${outFile}`);

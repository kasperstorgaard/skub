/**
 * Measures how well the scoring composite tracks human judgement: scores the
 * ground-truth anchors plus every rated candidate, and reports the Spearman
 * correlation between ratings and composite scores, the ordered table (so
 * misplaced boards are visible), and per-metric ρ — the evidence base for
 * promoting or demoting composite terms.
 *
 * Run after any `CALIBRATION` change. Solves are cached and
 * calibration-independent, so iterations cost seconds.
 *
 * Usage: `deno task check-anchors [--timeout=60000]`
 */
import { GENERATED_DIR, parseGenerated } from "#/game/generated.ts";
import { aggregateMetrics, METRIC_CATALOG } from "#/game/metric-catalog.ts";
import { CALIBRATION } from "#/game/scoring.ts";
import { boardScore, flag, solveDir, solveFiles } from "#/scripts/lib/boards.ts";
import { spearman } from "#/scripts/lib/report.ts";
import type { SolvedBoard } from "#/scripts/lib/score-worker.ts";

/** Corpus anchors, mapped onto the candidates' 1–5 star scale. */
const ANCHORS: Record<string, number> = {
  torstein: 5,
  malene: 5,
  erik: 2,
  kim: 1,
};

const timeoutMs = Number(flag("--timeout=") ?? "60000");

type Row = { name: string; rating: number; score: number; board: SolvedBoard };

const rows: Row[] = [];
const skipped: string[] = [];

const anchors = await solveFiles(
  Object.keys(ANCHORS).map((slug) => `static/puzzles/${slug}.md`),
  { timeoutMs, onProgress: (slug) => console.log(`solving ${slug}…`) },
);
skipped.push(...anchors.skipped);

for (const [slug, board] of anchors.boards) {
  rows.push({
    name: slug,
    rating: ANCHORS[slug],
    score: boardScore(board),
    board,
  });
}
const anchorCount = rows.length;

const candidates = await solveDir(GENERATED_DIR, {
  timeoutMs,
  onProgress: (slug) => console.log(`solving ${slug}…`),
});
skipped.push(...candidates.skipped);

for (const [slug, board] of candidates.boards) {
  const stored = parseGenerated(
    await Deno.readTextFile(`${GENERATED_DIR}/${slug}.md`),
  );
  // Unrated candidates carry no ground truth.
  if (stored.rating === undefined) continue;
  rows.push({
    name: stored.name,
    rating: stored.rating,
    score: boardScore(board),
    board,
  });
}

rows.sort((a, b) => b.score - a.score);

console.log(`\nCalibration v${CALIBRATION.version} vs human judgement\n`);
console.log("score  ★  name");
console.log("-".repeat(34));
for (const row of rows) {
  const anchor = row.name in ANCHORS ? " (anchor)" : "";
  console.log(`${row.score.toFixed(3)}  ${row.rating}  ${row.name}${anchor}`);
}

const ratings = rows.map((row) => row.rating);
const rho = spearman(ratings, rows.map((row) => row.score));

console.log(
  `\nSpearman ρ = ${rho.toFixed(3)} over ${rows.length} boards ` +
    `(${anchorCount} anchors + ${rows.length - anchorCount} rated candidates)` +
    (skipped.length ? `; skipped: ${skipped.join(", ")}` : ""),
);
console.log("Target: ρ → +1. The table above shows which boards sit out of order.");

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

/**
 * Measures how well the current scoring composite tracks human judgement:
 * scores the ground-truth anchor puzzles (corpus) plus every rated generated
 * candidate, then reports the Spearman rank correlation between human ratings
 * and composite scores, with the full ordered table so misordered boards are
 * visible. Run after any `CALIBRATION` change — the goal is ρ trending to +1
 * (v1 was negative: the composite was anti-correlated).
 *
 * Also reports per-metric ρ — which individual metrics track the ratings —
 * the evidence base for promoting/demoting composite terms.
 *
 * Boards are solved in a subprocess (crash/OOM isolation, one scoring path via
 * `compare-generated.ts`'s worker mode), but the solve-derived route metrics
 * are cached content-hashed and calibration-independent: composites are
 * recomputed in-process from the cache, so calibration iterations don't pay
 * for re-solving.
 *
 * Usage: `deno task check-anchors [--timeout=60000]`
 */
import { GENERATED_DIR, parseGenerated } from "#/game/generated.ts";
import {
  type BoundCtx,
  CALIBRATION,
  compositeScore,
  type Metrics,
  varietyScore,
} from "#/game/scoring.ts";
import type { WorkerOutput } from "#/scripts/compare-generated.ts";

/**
 * Corpus ground-truth anchors (see the scoring-calibration-anchors memory):
 * torstein ≳ malene ≫ erik > kim, mapped onto the candidates' 1–5 star scale.
 */
const ANCHORS: Record<string, number> = {
  torstein: 5,
  malene: 5,
  erik: 2,
  kim: 1,
};

const CACHE_FILE = "scoring/.cache/route-metrics.json";

const flag = (name: string) =>
  Deno.args.find((a) => a.startsWith(name))?.slice(name.length);
const timeoutMs = Number(flag("--timeout=") ?? "60000");

type CacheEntry = { hash: string; ctx: BoundCtx; routes: Metrics[] };

async function contentHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Solves one file via compare-generated's worker mode; null on crash/timeout. */
async function solveFile(path: string): Promise<WorkerOutput | null> {
  try {
    const { code, stdout } = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "scripts/compare-generated.ts", `--file=${path}`],
      stdout: "piped",
      stderr: "null",
      signal: AbortSignal.timeout(timeoutMs),
    }).output();
    if (code !== 0) return null;
    return JSON.parse(new TextDecoder().decode(stdout));
  } catch {
    return null;
  }
}

let cache: Record<string, CacheEntry> = {};
try {
  cache = JSON.parse(await Deno.readTextFile(CACHE_FILE));
} catch {
  // no cache yet
}

/**
 * The metric keys aggregated per board (max across routes unless noted).
 * Doubles as the cache staleness check: an entry solved before a metric
 * existed lacks its key and must be re-solved.
 */
const MAX_KEYS = [
  "setupRatio",
  "coverage",
  "deception",
  "reversals",
  "crossTrailOverlap",
  "totalDistance",
  "pieceUsage",
  "stopWeighted",
  "uniqueSolutions",
  "wallUtilization",
  "deadSpace",
  "clumping",
  "firstMovePrecision",
  "searchProfile",
  "isolationGap",
  "nearMissDensity",
] as const satisfies readonly (keyof Metrics)[];
const MIN_KEYS = [
  "pointlessClearance",
  "sameDirectionRepeat",
] as const satisfies readonly (keyof Metrics)[];

/** Route metrics for a file — from the cache when its content is unchanged. */
async function routeMetrics(
  path: string,
): Promise<Pick<CacheEntry, "ctx" | "routes"> | null> {
  const hash = await contentHash(await Deno.readTextFile(path));
  const cached = cache[path];
  const complete = cached &&
    [...MAX_KEYS, ...MIN_KEYS].every((key) => key in cached.routes[0]);
  if (cached && cached.hash === hash && complete) return cached;

  const solved = await solveFile(path);
  if (!solved) return null;
  cache[path] = { hash, ctx: solved.ctx, routes: solved.routes };
  return cache[path];
}

type Row = {
  name: string;
  rating: number;
  score: number;
  metrics: Record<string, number>;
  source: string;
};

/**
 * Board-level metric aggregates, mirroring `computeMetrics`' reduction: max
 * across routes for signals, min for the two penalties (shared metrics are
 * route-constant, so max is a no-op) — plus the shaped `variety` term.
 */
function aggregateMetrics(routes: Metrics[]): Record<string, number> {
  const agg = (key: keyof Metrics, reduce: "max" | "min") => {
    let out = reduce === "max" ? -Infinity : Infinity;
    for (const m of routes) out = Math[reduce](out, m[key]);
    return out;
  };
  const out: Record<string, number> = {};
  for (const key of MAX_KEYS) out[key] = agg(key, "max");
  for (const key of MIN_KEYS) out[key] = agg(key, "min");
  out.variety = varietyScore(out.uniqueSolutions);
  return out;
}

const rows: Row[] = [];
const skipped: string[] = [];

async function addRow(path: string, name: string, rating: number, src: string) {
  const entry = await routeMetrics(path);
  if (!entry) {
    skipped.push(name);
    return;
  }
  let sum = 0;
  for (const m of entry.routes) sum += compositeScore(m, entry.ctx);
  rows.push({
    name,
    rating,
    score: sum / entry.routes.length,
    metrics: aggregateMetrics(entry.routes),
    source: src,
  });
}

for (const [slug, rating] of Object.entries(ANCHORS)) {
  await addRow(`static/puzzles/${slug}.md`, slug, rating, "anchor");
}

try {
  for await (const entry of Deno.readDir(GENERATED_DIR)) {
    if (!entry.name.endsWith(".md")) continue;
    const path = `${GENERATED_DIR}/${entry.name}`;
    let rating: number | undefined;
    let name: string;
    try {
      const c = parseGenerated(await Deno.readTextFile(path));
      rating = c.rating;
      name = c.name;
    } catch {
      continue;
    }
    if (rating === undefined) continue; // unrated — no ground truth

    await addRow(path, name, rating, "generated");
  }
} catch {
  // no generated store — anchors alone still work
}

await Deno.mkdir(CACHE_FILE.slice(0, CACHE_FILE.lastIndexOf("/")), {
  recursive: true,
});
await Deno.writeTextFile(CACHE_FILE, JSON.stringify(cache));

/** Ranks with ties averaged (standard for Spearman). */
function ranks(values: number[]): number[] {
  const sorted = values.map((v, i) => [v, i] as const)
    .sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1][0] === sorted[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[sorted[k][1]] = avg;
    i = j + 1;
  }
  return out;
}

/** Spearman ρ = Pearson correlation of the two rank vectors. */
function spearman(a: number[], b: number[]): number {
  const ra = ranks(a);
  const rb = ranks(b);
  const n = ra.length;
  const meanA = ra.reduce((s, x) => s + x, 0) / n;
  const meanB = rb.reduce((s, x) => s + x, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (ra[i] - meanA) * (rb[i] - meanB);
    varA += (ra[i] - meanA) ** 2;
    varB += (rb[i] - meanB) ** 2;
  }
  return varA && varB ? cov / Math.sqrt(varA * varB) : 0;
}

rows.sort((a, b) => b.score - a.score);

console.log(`\nCalibration v${CALIBRATION.version} vs human judgement\n`);
console.log("score  ★  name");
console.log("-".repeat(34));
for (const r of rows) {
  const marker = r.source === "anchor" ? " (anchor)" : "";
  console.log(
    `${r.score.toFixed(3)}  ${r.rating}  ${r.name}${marker}`,
  );
}

const ratings = rows.map((r) => r.rating);
const rho = spearman(ratings, rows.map((r) => r.score));
console.log(
  `\nSpearman ρ = ${rho.toFixed(3)} over ${rows.length} boards ` +
    `(${rows.filter((r) => r.source === "anchor").length} anchors + ` +
    `${rows.filter((r) => r.source === "generated").length} rated candidates)` +
    (skipped.length ? `; skipped: ${skipped.join(", ")}` : ""),
);
console.log(
  "Target: ρ → +1. The table above shows which boards sit out of order.",
);

const inComposite = new Set([
  ...Object.keys(CALIBRATION.positive),
  ...Object.keys(CALIBRATION.negative),
]);
const metricRhos = Object.keys(rows[0].metrics)
  .map((key) => ({
    key,
    rho: spearman(ratings, rows.map((r) => r.metrics[key])),
  }))
  .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

console.log("\nPer-metric ρ vs rating (composite terms marked ●):\n");
for (const { key, rho: r } of metricRhos) {
  const mark = inComposite.has(key) ? "●" : " ";
  const bar = "█".repeat(Math.round(Math.abs(r) * 20));
  console.log(
    `${mark} ${key.padEnd(20)} ${r >= 0 ? "+" : "-"}${
      Math.abs(r).toFixed(3)
    }  ${bar}`,
  );
}

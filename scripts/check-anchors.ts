/**
 * Measures how well the current scoring composite tracks human judgement:
 * scores the ground-truth anchor puzzles (corpus) plus every rated generated
 * candidate, then reports the Spearman rank correlation between human ratings
 * and composite scores, with the full ordered table so misordered boards are
 * visible. Run after any `CALIBRATION` change — the goal is ρ trending to +1
 * (v1 was negative: the composite was anti-correlated).
 *
 * Each board is scored in its own subprocess (crash/OOM isolation), reusing
 * `compare-generated.ts`'s worker mode so there's exactly one scoring path.
 *
 * Usage: `deno task check-anchors [--timeout=60000]`
 */
import { GENERATED_DIR, parseGenerated } from "#/game/generated.ts";
import { CALIBRATION } from "#/game/scoring.ts";

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

const flag = (name: string) =>
  Deno.args.find((a) => a.startsWith(name))?.slice(name.length);
const timeoutMs = Number(flag("--timeout=") ?? "60000");

/** Scores one file via compare-generated's worker mode; null on crash/timeout. */
async function scoreFile(path: string): Promise<number | null> {
  try {
    const { code, stdout } = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "scripts/compare-generated.ts", `--file=${path}`],
      stdout: "piped",
      stderr: "null",
      signal: AbortSignal.timeout(timeoutMs),
    }).output();
    if (code !== 0) return null;
    const { values } = JSON.parse(new TextDecoder().decode(stdout));
    return values.score as number;
  } catch {
    return null;
  }
}

type Row = { name: string; rating: number; score: number; source: string };

const rows: Row[] = [];
const skipped: string[] = [];

for (const [slug, rating] of Object.entries(ANCHORS)) {
  const score = await scoreFile(`static/puzzles/${slug}.md`);
  if (score === null) skipped.push(slug);
  else rows.push({ name: slug, rating, score, source: "anchor" });
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

    const score = await scoreFile(path);
    if (score === null) skipped.push(name);
    else rows.push({ name, rating, score, source: "generated" });
  }
} catch {
  // no generated store — anchors alone still work
}

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

const rho = spearman(rows.map((r) => r.rating), rows.map((r) => r.score));
console.log(
  `\nSpearman ρ = ${rho.toFixed(3)} over ${rows.length} boards ` +
    `(${rows.filter((r) => r.source === "anchor").length} anchors + ` +
    `${rows.filter((r) => r.source === "generated").length} rated candidates)` +
    (skipped.length ? `; skipped: ${skipped.join(", ")}` : ""),
);
console.log(
  "Target: ρ → +1. The table above shows which boards sit out of order.",
);

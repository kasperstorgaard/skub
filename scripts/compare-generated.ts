/**
 * Diffs the labeled generator candidates (the gitignored `generated/` store)
 * against the hand-built corpus, so we can see which scoring metrics actually
 * separate the boards a human liked from the ones they didn't — the signal the
 * scoring composite needs to be re-calibrated against (spec Phase 2).
 *
 * Every board is re-solved and re-scored here (never from a stored score), so
 * the report always reflects the current `game/scoring.ts` calibration. Each
 * board is scored in its own subprocess so a branchy board OOMs only itself,
 * exactly like `score-corpus.ts` / `gate-corpus.ts`.
 *
 * Buckets compared: corpus vs high-rated (4–5) vs low-rated (1–2) candidates,
 * plus per-reason-tag metric means.
 *
 * Usage: `deno task compare-generated [outfile] [--timeout=30000]`
 */
import {
  GENERATED_DIR,
  parseGenerated,
  type ReasonTag,
} from "#/game/generated.ts";
import { parsePuzzle } from "#/game/parser.ts";
import {
  type BoundCtx,
  CALIBRATION,
  computeMetrics,
  type Metrics,
  scoreBoard,
} from "#/game/scoring.ts";
import { solveExhaustiveSync } from "#/game/solver.ts";

const CORPUS_DIR = "static/puzzles";
// Corpus scores only change when the calibration does, so they're cached per
// version (content-hashed per file) — reruns only pay for the candidates.
const CACHE_FILE = `scoring/.cache/corpus-scores-v${CALIBRATION.version}.json`;

/** Metrics reported, in column order. Score/worst come from `scoreBoard`. */
const METRICS = [
  "score",
  "worst",
  "deception",
  "reversals",
  "setupRatio",
  "firstMovePrecision",
  "uniqueSolutions",
  "deadSpace",
  "wallUtilization",
  "clumping",
  "isolationGap",
  "nearMissDensity",
] as const;

type Values = Record<(typeof METRICS)[number], number>;

const flag = (name: string) =>
  Deno.args.find((a) => a.startsWith(name))?.slice(name.length);

/**
 * Full solve output for one board: the report `values` plus the raw per-route
 * metrics and bound context, which are calibration-independent — tooling (e.g.
 * `check-anchors`) caches `ctx`/`routes` and recomputes composites in-process
 * so calibration changes don't force a re-solve.
 */
export type WorkerOutput = {
  slug: string;
  values: Values;
  ctx: BoundCtx;
  routes: Metrics[];
};

/** Worker mode: score one puzzle file and emit its metric values as JSON. */
function scoreFile(path: string): WorkerOutput {
  const puzzle = parsePuzzle(Deno.readTextFileSync(path));
  // Overshoot powers the isolation metrics; offline scoring only — the
  // gameplay and generation-gate solves never pay for it.
  const result = solveExhaustiveSync(puzzle.board, {
    maxDepth: 15,
    overshoot: 2,
  });
  const m = computeMetrics(puzzle.board, result);
  const scored = scoreBoard(puzzle.board, result);
  return {
    slug: puzzle.slug,
    ctx: {
      minMoves: result.minMoves,
      blockers: puzzle.board.pieces.filter((p) => p.type === "blocker").length,
    },
    routes: scored.perSolution.map((s) => s.metrics),
    values: {
      score: scored.score,
      worst: scored.min,
      deception: m.deception,
      reversals: m.reversals,
      setupRatio: m.setupRatio,
      firstMovePrecision: m.firstMovePrecision,
      uniqueSolutions: m.uniqueSolutions,
      deadSpace: m.deadSpace,
      wallUtilization: m.wallUtilization,
      clumping: m.clumping,
      isolationGap: m.isolationGap,
      nearMissDensity: m.nearMissDensity,
    },
  };
}

const workerFile = flag("--file=");
if (workerFile) {
  console.log(JSON.stringify(scoreFile(workerFile)));
  Deno.exit(0);
}

// ---- orchestrator ----

const outFile = Deno.args.find((a) => !a.startsWith("--")) ??
  "scoring/reports/generated-vs-corpus.md";
const timeoutMs = Number(flag("--timeout=") ?? "30000");

async function scoreInSubprocess(
  path: string,
): Promise<{ slug: string; values: Values } | null> {
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

/** Scores every `.md` in a directory (subprocess each). Missing dir → []. */
async function scoreDir(dir: string): Promise<Map<string, Values>> {
  const out = new Map<string, Values>();
  let entries: Deno.DirEntry[];
  try {
    entries = await Array.fromAsync(Deno.readDir(dir));
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    const row = await scoreInSubprocess(`${dir}/${entry.name}`);
    if (row) out.set(entry.name.replace(/\.md$/, ""), row.values);
  }
  return out;
}

type CacheEntry = { hash: string; values: Values };

async function contentHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Scores the corpus through a per-file cache: a puzzle is re-scored only when
 * uncached or its content hash changed; entries for removed files are dropped.
 * The cache file is keyed to `CALIBRATION.version`, so bumping the calibration
 * invalidates everything at once.
 */
async function scoreCorpusCached(): Promise<Map<string, Values>> {
  let cache: Record<string, CacheEntry> = {};
  try {
    cache = JSON.parse(await Deno.readTextFile(CACHE_FILE));
  } catch {
    // no cache yet
  }

  const out = new Map<string, Values>();
  const fresh: Record<string, CacheEntry> = {};

  for await (const entry of Deno.readDir(CORPUS_DIR)) {
    if (!entry.name.endsWith(".md")) continue;
    const stem = entry.name.replace(/\.md$/, "");
    const path = `${CORPUS_DIR}/${entry.name}`;
    const hash = await contentHash(await Deno.readTextFile(path));

    const cached = cache[stem];
    if (cached && cached.hash === hash) {
      fresh[stem] = cached;
      out.set(stem, cached.values);
      continue;
    }

    const row = await scoreInSubprocess(path);
    if (!row) continue; // too branchy — skipped, and never cached
    fresh[stem] = { hash, values: row.values };
    out.set(stem, row.values);
  }

  await Deno.mkdir(CACHE_FILE.slice(0, CACHE_FILE.lastIndexOf("/")), {
    recursive: true,
  });
  await Deno.writeTextFile(CACHE_FILE, JSON.stringify(fresh));
  return out;
}

/** Reads feedback (rating, reasons) for each generated candidate. */
async function readFeedback(): Promise<
  Map<string, { rating?: number; reasons: ReasonTag[] }>
> {
  const out = new Map<string, { rating?: number; reasons: ReasonTag[] }>();
  let entries: Deno.DirEntry[];
  try {
    entries = await Array.fromAsync(Deno.readDir(GENERATED_DIR));
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    const slug = entry.name.replace(/\.md$/, "");
    try {
      const c = parseGenerated(
        await Deno.readTextFile(`${GENERATED_DIR}/${entry.name}`),
      );
      out.set(slug, { rating: c.rating, reasons: c.reasons ?? [] });
    } catch {
      // unparseable candidate — skip
    }
  }
  return out;
}

const corpus = await scoreCorpusCached();
const generated = await scoreDir(GENERATED_DIR);
const feedback = await readFeedback();

// ---- bucketing ----

const corpusRows = [...corpus.values()];
const genHigh: Values[] = [];
const genLow: Values[] = [];
const byReason = new Map<ReasonTag, Values[]>();

for (const [slug, values] of generated) {
  const fb = feedback.get(slug);
  if (!fb) continue;
  if (fb.rating !== undefined && fb.rating >= 4) genHigh.push(values);
  if (fb.rating !== undefined && fb.rating <= 2) genLow.push(values);
  for (const reason of fb.reasons) {
    const list = byReason.get(reason) ?? [];
    list.push(values);
    byReason.set(reason, list);
  }
}

// ---- formatting ----

const f = (n: number) => n.toFixed(3);

const mean = (rows: Values[], metric: keyof Values) =>
  rows.length ? rows.reduce((a, r) => a + r[metric], 0) / rows.length : NaN;

const quantiles = (rows: Values[], metric: keyof Values) => {
  if (!rows.length) return "—";
  const s = rows.map((r) => r[metric]).sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return `${f(s[0])} / ${f(q(0.5))} / ${f(s[s.length - 1])}`;
};

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

const distTable = table(
  ["metric", "corpus (min/med/max)", "high-rated", "low-rated"],
  METRICS.map((m) => [
    m,
    quantiles(corpusRows, m),
    quantiles(genHigh, m),
    quantiles(genLow, m),
  ]),
);

const reasonRows = [...byReason.entries()].map(([reason, rows]) => [
  reason,
  String(rows.length),
  ...METRICS.map((m) => f(mean(rows, m))),
]);
const reasonTable = reasonRows.length
  ? table(["reason", "n", ...METRICS], reasonRows)
  : "_no tagged candidates yet_";

const md = [
  `# Generated vs corpus`,
  ``,
  `Corpus: ${corpusRows.length} scored. Generated: ${generated.size} scored, ` +
  `${genHigh.length} high-rated (4–5), ${genLow.length} low-rated (1–2).`,
  ``,
  `All boards re-scored at the current \`game/scoring.ts\` calibration. The`,
  `question this answers: which metrics separate the boards a human kept from`,
  `the ones they rejected — i.e. which advisory signals are worth promoting.`,
  ``,
  `## Metric distributions (min / median / max)`,
  ``,
  distTable,
  ``,
  `## Per-reason-tag metric means`,
  ``,
  reasonTable,
  ``,
].join("\n");

if (outFile.includes("/")) {
  await Deno.mkdir(outFile.slice(0, outFile.lastIndexOf("/")), {
    recursive: true,
  });
}
await Deno.writeTextFile(outFile, md);
console.log(
  `Compared ${generated.size} generated vs ${corpusRows.length} corpus → ${outFile}`,
);

/**
 * Runs the board-economy gates (G7 wall utilization, G8 dead space) over every
 * puzzle in static/puzzles and reports the pass/fail split plus the underlying
 * metric distributions — so the G7/G8 thresholds can be calibrated against the
 * hand-built corpus. The metrics are solution-derived (they measure real
 * trails / real wall stops), not static. Human puzzles are allowed to fail some
 * gates; a large fail rate (say >50%) means the thresholds are wrong.
 *
 * Each puzzle is scored in its own subprocess (a branchy board can OOM its solve)
 * exactly like `score-corpus.ts`.
 *
 * Usage: `deno run -A scripts/gate-corpus.ts [--only=<slug>] [--timeout=30000]`
 */
import { parsePuzzle } from "#/game/parser.ts";
import {
  deadSpace,
  deduplicateSolutions,
  wallUtilization,
} from "#/game/scoring.ts";
import { enumerateSolutions, solveExhaustiveSync } from "#/game/solver.ts";

const PUZZLE_DIR = "static/puzzles";
// Keep in sync with the G7/G8 constants in game/scoring.ts.
const MIN_WALL_UTILIZATION = 0.2;
const MAX_DEAD_SPACE = 0.8;

const flag = (name: string) =>
  Deno.args.find((a) => a.startsWith(name))?.slice(name.length);

type Row = {
  slug: string;
  difficulty: string;
  minMoves: number;
  walls: number;
  wallUtilization: number;
  deadSpace: number;
  passG7: boolean;
  passG8: boolean;
};

function analyzeFile(path: string): Row {
  const puzzle = parsePuzzle(Deno.readTextFileSync(path));
  const result = solveExhaustiveSync(puzzle.board, { maxDepth: 15 });
  const solutions = deduplicateSolutions(enumerateSolutions(result.dag));
  const wu = wallUtilization(puzzle.board, solutions);
  const ds = deadSpace(puzzle.board, solutions);
  return {
    slug: puzzle.slug,
    difficulty: puzzle.difficulty,
    minMoves: result.minMoves,
    walls: puzzle.board.walls.length,
    wallUtilization: wu,
    deadSpace: ds,
    passG7: wu >= MIN_WALL_UTILIZATION,
    passG8: ds <= MAX_DEAD_SPACE,
  };
}

const workerFile = flag("--file=");
if (workerFile) {
  console.log(JSON.stringify(analyzeFile(workerFile)));
  Deno.exit(0);
}

// ---- orchestrator ----
const only = flag("--only=");
const timeoutMs = Number(flag("--timeout=") ?? "30000");

async function inSubprocess(path: string): Promise<Row | null> {
  try {
    const { code, stdout } = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "scripts/gate-corpus.ts", `--file=${path}`],
      stdout: "piped",
      stderr: "null",
      signal: AbortSignal.timeout(timeoutMs),
    }).output();
    if (code !== 0) return null;
    return JSON.parse(new TextDecoder().decode(stdout)) as Row;
  } catch {
    return null;
  }
}

const rows: Row[] = [];
const skipped: string[] = [];
for await (const entry of Deno.readDir(PUZZLE_DIR)) {
  if (!entry.name.endsWith(".md")) continue;
  if (only && entry.name !== `${only}.md`) continue;
  const row = await inSubprocess(`${PUZZLE_DIR}/${entry.name}`);
  if (row) rows.push(row);
  else skipped.push(entry.name.replace(/\.md$/, ""));
}
rows.sort((a, b) => a.slug.localeCompare(b.slug));

const f = (n: number) => n.toFixed(3);
const pct = (n: number, d: number) =>
  d ? `${Math.round((n / d) * 100)}%` : "n/a";
const quantiles = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return `min ${f(s[0])} / p25 ${f(q(0.25))} / median ${f(q(0.5))} / p75 ${
    f(q(0.75))
  } / max ${f(s[s.length - 1])}`;
};

const failG7 = rows.filter((r) => !r.passG7);
const failG8 = rows.filter((r) => !r.passG8);
const failEither = rows.filter((r) => !r.passG7 || !r.passG8);

console.log(
  `\nCorpus board-quality gates — ${rows.length} scored, ${skipped.length} skipped\n`,
);
console.log(
  `wallUtilization: ${quantiles(rows.map((r) => r.wallUtilization))}`,
);
console.log(`deadSpace:       ${quantiles(rows.map((r) => r.deadSpace))}\n`);
console.log(
  `G7 (wallUtilization >= ${MIN_WALL_UTILIZATION}): ${failG7.length} fail (${
    pct(failG7.length, rows.length)
  })`,
);
console.log(
  `G8 (deadSpace <= ${MAX_DEAD_SPACE}):        ${failG8.length} fail (${
    pct(failG8.length, rows.length)
  })`,
);
console.log(
  `either:                              ${failEither.length} fail (${
    pct(failEither.length, rows.length)
  })\n`,
);

const fmtFail = (r: Row, metric: "wallUtilization" | "deadSpace") =>
  `  ${r.slug.padEnd(14)} ${r.difficulty.padEnd(7)} mM${
    String(r.minMoves).padEnd(3)
  } walls${String(r.walls).padEnd(3)} ${metric}=${f(r[metric])}`;

if (failG7.length) {
  console.log("G7 fails (low wall utilization):");
  for (const r of failG7) console.log(fmtFail(r, "wallUtilization"));
  console.log();
}
if (failG8.length) {
  console.log("G8 fails (high dead space):");
  for (const r of failG8) console.log(fmtFail(r, "deadSpace"));
  console.log();
}
if (skipped.length) {
  console.log(`Skipped (too branchy / unsolved): ${skipped.join(", ")}`);
}

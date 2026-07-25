import { compositeScore } from "#/game/scoring.ts";
import type { SolvedBoard } from "#/scripts/lib/score-worker.ts";

/**
 * Solving a board is slow (seconds, occasionally minutes) but its output is
 * calibration-independent, so one content-hashed cache serves every report and
 * survives `CALIBRATION` changes — tuning iterations cost seconds, not a full
 * corpus re-solve.
 */
const CACHE_FILE = "scoring/.cache/boards.json";

export const flag = (name: string): string | undefined =>
  Deno.args.find((arg) => arg.startsWith(name))?.slice(name.length);

/** Composite score of every route, at the current calibration. */
export const routeScores = (board: SolvedBoard): number[] =>
  board.routes.map((route) => compositeScore(route, board.ctx));

/** Headline score: the mean route score. */
export const boardScore = (board: SolvedBoard): number => {
  const scores = routeScores(board);
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

/** Worst route — the outlier detector curation filters on. */
export const worstRoute = (board: SolvedBoard): number =>
  Math.min(...routeScores(board));

async function contentHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Solves one file in a subprocess so a branchy board OOMs only itself. */
async function solveIsolated(
  path: string,
  timeoutMs: number,
): Promise<SolvedBoard | null> {
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "scripts/lib/score-worker.ts", path],
    stdout: "piped",
    stderr: "null",
    signal: AbortSignal.timeout(timeoutMs),
  }).output().catch(() => null);

  if (!result?.success) return null;
  return JSON.parse(new TextDecoder().decode(result.stdout));
}

type Cache = Record<string, { hash: string; board: SolvedBoard }>;

async function readCache(): Promise<Cache> {
  try {
    return JSON.parse(await Deno.readTextFile(CACHE_FILE));
  } catch {
    return {};
  }
}

async function writeCache(cache: Cache): Promise<void> {
  await Deno.mkdir("scoring/.cache", { recursive: true });
  await Deno.writeTextFile(CACHE_FILE, JSON.stringify(cache));
}

export type SolveOptions = {
  timeoutMs?: number;
  /** Called before a board is actually solved (cache misses only). */
  onProgress?: (slug: string) => void;
};

export type SolveResult = {
  /** Keyed by file stem, which is the puzzle slug. */
  boards: Map<string, SolvedBoard>;
  /** Slugs that crashed or timed out — reported, never cached. */
  skipped: string[];
};

/** Solves the given puzzle files, reusing cached results for unchanged ones. */
export async function solveFiles(
  paths: string[],
  options: SolveOptions = {},
): Promise<SolveResult> {
  const { timeoutMs = 60_000, onProgress } = options;
  const cache = await readCache();

  const boards = new Map<string, SolvedBoard>();
  const skipped: string[] = [];

  for (const path of paths) {
    const slug = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
    const hash = await contentHash(await Deno.readTextFile(path));

    if (cache[path]?.hash === hash) {
      boards.set(slug, cache[path].board);
      continue;
    }

    onProgress?.(slug);
    const solved = await solveIsolated(path, timeoutMs);
    if (!solved) {
      skipped.push(slug);
      continue;
    }

    cache[path] = { hash, board: solved };
    boards.set(slug, solved);
    // Flushed per board, not per batch: a full corpus run takes long enough
    // that losing it to an interrupt would be painful.
    await writeCache(cache);
  }

  return { boards, skipped };
}

/** Every `.md` in a directory, sorted. A missing directory yields none. */
export async function puzzleFiles(dir: string): Promise<string[]> {
  try {
    const entries = await Array.fromAsync(Deno.readDir(dir));
    return entries
      .filter((entry) => entry.name.endsWith(".md"))
      .map((entry) => `${dir}/${entry.name}`)
      .sort();
  } catch {
    return [];
  }
}

/** Solves every `.md` in `dir`. A missing directory yields no boards. */
export const solveDir = async (
  dir: string,
  options: SolveOptions = {},
): Promise<SolveResult> => solveFiles(await puzzleFiles(dir), options);

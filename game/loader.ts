import { getPuzzleNumber, getTodaysPuzzleNumber } from "#/game/date.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { boardCanonicalHash } from "#/game/scoring.ts";
import {
  Difficulty,
  PaginatedData,
  PaginationState,
  Puzzle,
  PuzzleManifestEntry,
} from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";
import { sortList } from "#/lib/list.ts";

// Resolve from cwd — always the project root locally and on Deno Deploy.
const PUZZLES_DIR = `${Deno.cwd()}/static/puzzles`;

// Default items per page
const ITEMS_PER_PAGE = 6;

// simple in memory cache for this very important file
let manifestCache: PuzzleManifestEntry[] | null = null;

/**
 * Reads the puzzle manifest from disk. Cached after first read — the corpus is
 * static between requests, with one exception: promoting a candidate writes a
 * new puzzle, and that path calls {@link invalidateCorpus}.
 */
async function getPuzzleManifest(): Promise<PuzzleManifestEntry[]> {
  if (manifestCache) return manifestCache;

  const text = await Deno.readTextFile(`${PUZZLES_DIR}/manifest.json`);
  manifestCache = JSON.parse(text);

  return manifestCache!;
}

let corpusHashCache: Set<string> | null = null;

/**
 * Drops both corpus caches, for the one thing that changes `static/puzzles`
 * while the server is running: promoting a candidate. Without this the process
 * keeps serving the manifest it read at boot — the promoted puzzle wouldn't
 * appear in the archive, and the generator's novelty gate wouldn't know the
 * board exists, so it could hand back the one just promoted.
 */
export function invalidateCorpus(): void {
  manifestCache = null;
  corpusHashCache = null;
}

/**
 * Canonical hashes of every puzzle board in the corpus, for the generator's G3
 * novelty gate. Reads and parses each markdown once (the manifest is a
 * lightweight index without boards), then caches — the corpus is static between
 * requests.
 */
export async function getCorpusHashes(): Promise<Set<string>> {
  if (corpusHashCache) return corpusHashCache;

  const manifest = await getPuzzleManifest();
  const hashes = new Set<string>();
  for (const entry of manifest) {
    const puzzle = await getPuzzle(entry.slug);
    if (puzzle) hashes.add(boardCanonicalHash(puzzle.board));
  }

  corpusHashCache = hashes;
  return hashes;
}

/**
 * Every puzzle name in the corpus (from the cached manifest), for de-duping
 * auto-assigned candidate names against existing puzzles.
 */
export async function getCorpusNames(): Promise<Set<string>> {
  const manifest = await getPuzzleManifest();
  return new Set(manifest.map((entry) => entry.name));
}

/** A manifest entry, plus whether its scheduled day is still ahead. */
export type AvailableEntry = PuzzleManifestEntry & { isFuture: boolean };

/**
 * Manifest entries available today: number <= day-of-year, onboarding excluded.
 * Locally the schedule doesn't apply — there's no point hiding tomorrow's
 * puzzle from the person who wrote it.
 *
 * Which means the local list mixes released and unreleased boards, so every
 * entry says which it is. Computed here rather than written into
 * `manifest.json`: "future" is a fact about today, and the manifest is only
 * regenerated on a build, so a stored flag would be a lie by the next midnight.
 */
export async function getAvailableEntries(): Promise<AvailableEntry[]> {
  const today = getTodaysPuzzleNumber();

  const manifest = await getPuzzleManifest();

  return manifest
    .filter((entry) => !entry.hidden)
    .filter((entry) => isDev || (entry.number ?? 0) <= today)
    .map((entry) => ({ ...entry, isFuture: (entry.number ?? 0) > today }));
}

/**
 * Manifest entries available after today: number > day-of-year, onboarding excluded.
 */
export async function getFutureEntries() {
  const today = getTodaysPuzzleNumber();

  const manifest = await getPuzzleManifest();

  return manifest
    .filter((entry) => !entry.hidden)
    .filter((entry) => (entry.number ?? 0) > today);
}

/**
 * Loads a puzzle from a markdown file by slug.
 */
export async function getPuzzle(puzzleSlug: string): Promise<Puzzle | null> {
  let content: string;
  try {
    content = await Deno.readTextFile(`${PUZZLES_DIR}/${puzzleSlug}.md`);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    throw err;
  }
  return parsePuzzle(content);
}

type ListOptions = Pick<PaginationState, "page" | "itemsPerPage"> & {
  sortBy: "createdAt" | "difficulty" | "number";
  sortOrder: "ascending" | "descending";
  excludeSlugs?: string[];
  isFuture?: boolean;
};

/**
 * Lists available puzzles, paginated and sorted.
 */
export async function listPuzzles(
  options: ListOptions = {
    page: 1,
    itemsPerPage: ITEMS_PER_PAGE,
    sortBy: "createdAt",
    sortOrder: "descending",
    excludeSlugs: ["tutorial"],
  },
): Promise<PaginatedData<Puzzle>> {
  let entries = options.isFuture
    ? await getFutureEntries()
    : await getAvailableEntries();

  entries = entries
    .filter((entry) => !options.excludeSlugs?.includes(entry.slug));

  entries = sortList(entries, options);

  const totalItems = entries.length;

  const limit = options?.itemsPerPage ?? ITEMS_PER_PAGE;
  const page = options?.page ?? 1;
  const start = (page - 1) * limit;
  const end = start + limit;

  entries = entries.slice(start, end);

  const items = await Promise.all(
    entries.map((entry) => getPuzzle(entry.slug)),
  );

  if (items.some((item) => item == null)) {
    throw new Error("Manifest corrupted, unable to get all puzzles");
  }

  return {
    items: items as Puzzle[],
    pagination: {
      page,
      itemsPerPage: limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
}

/**
 * Counts available puzzles by difficulty. Uses the cached manifest so it's cheap.
 */
export async function getDifficultyBreakdown(): Promise<
  Record<Difficulty, number>
> {
  const entries = await getAvailableEntries();

  const breakdown: Record<Difficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
    ultra: 0,
  };
  for (const entry of entries) {
    breakdown[entry.difficulty]++;
  }
  return breakdown;
}

/**
 * The puzzle of the day: the newest one whose scheduled day has come.
 *
 * Filters the manifest itself rather than going through
 * `getAvailableEntries`, which locally hands back the whole schedule. That
 * widening is deliberate everywhere else — but the front page is what a player
 * sees, and today is today in dev too.
 */
export async function getTodaysPuzzle() {
  const today = getTodaysPuzzleNumber();
  const manifest = await getPuzzleManifest();

  const entry = manifest
    .filter((entry) => !entry.hidden && (entry.number ?? 0) <= today)
    .toSorted((a, b) => (b.number ?? 0) - (a.number ?? 0))[0];

  return entry ? getPuzzle(entry.slug) : null;
}

type GetRandomPuzzleOptions = {
  difficulty?: Difficulty[];
  excludeSlugs?: string[];
};

/**
 * Gets a random puzzle from the pool matching the given difficulty options.
 * Never an unreleased one: this feeds the recommendation, and recommending a
 * board no player could reach would be a local-only phantom.
 */
export async function getRandomPuzzle(
  options: GetRandomPuzzleOptions,
): Promise<Puzzle | null> {
  let entries = await getAvailableEntries();

  entries = entries
    .filter((puzzle) => !puzzle.isFuture)
    .filter((puzzle) =>
      options.difficulty ? options.difficulty.includes(puzzle.difficulty) : true
    )
    .filter((puzzle) => !options.excludeSlugs?.includes(puzzle.slug));

  if (!entries.length) return null;

  const entry = entries[Math.floor(Math.random() * entries.length)];

  return getPuzzle(entry.slug);
}

/**
 * Gets a puzzle by date
 */
export async function getPuzzleByDate(
  date: Temporal.PlainDate | Date,
): Promise<Puzzle | null> {
  const entries = await getAvailableEntries();

  // A date maps to the slot that falls on it.
  const slot = getPuzzleNumber(date);
  const entry = entries.find((puzzle) => puzzle.number === slot);
  if (!entry) return null;

  return getPuzzle(entry.slug);
}

/**
 * Gets the tutorial puzzle.
 */
export async function getTutorialPuzzle() {
  const manifest = await getPuzzleManifest();

  const entry = manifest.find((entry) => entry.onboardingLevel === 1);
  return entry ? getPuzzle(entry.slug) : null;
}

/**
 * Gets the next non-excluded onboarding puzzle.
 * TODO: extend onboarding sequence with more levels (currently caps at lone, level 3)
 */
export async function getOnboardingPuzzle(
  options: { excludeSlugs: string[] },
) {
  const manifest = await getPuzzleManifest();
  const lookup = new Set(options.excludeSlugs);

  const pool = manifest
    .filter((entry) => (entry.onboardingLevel ?? 0) > 1)
    .sort((a, b) => (a.onboardingLevel ?? 0) - (b.onboardingLevel ?? 0));

  const next = pool.find((entry) => !lookup.has(entry.slug)) ??
    pool[pool.length - 1];

  return getPuzzle(next.slug);
}

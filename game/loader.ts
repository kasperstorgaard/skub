import { getDayOfYear } from "#/game/date.ts";
import { parsePuzzle } from "#/game/parser.ts";
import {
  Difficulty,
  PaginatedData,
  PaginationState,
  Puzzle,
  PuzzleManifestEntry,
} from "#/game/types.ts";
import { sortList } from "#/lib/list.ts";

// Resolve from cwd — always the project root locally and on Deno Deploy.
const PUZZLES_DIR = `${Deno.cwd()}/static/puzzles`;

// Default items per page
const ITEMS_PER_PAGE = 6;

// simple in memory cache for this very important file
let manifestCache: PuzzleManifestEntry[] | null = null;

/**
 * Reads the puzzle manifest from disk. Cached after first read — the manifest
 * is static and never changes between requests.
 */
async function getPuzzleManifest(): Promise<PuzzleManifestEntry[]> {
  if (manifestCache) return manifestCache;

  const text = await Deno.readTextFile(`${PUZZLES_DIR}/manifest.json`);
  manifestCache = JSON.parse(text);

  return manifestCache!;
}

/**
 * Manifest entries available today: number <= day-of-year, onboarding excluded.
 */
export async function getAvailableEntries() {
  const today = new Date(Date.now());
  const dayOfYear = getDayOfYear(today);

  const manifest = await getPuzzleManifest();

  return manifest
    .filter((entry) => !entry.onboardingLevel)
    .filter((entry) => (entry.number ?? 0) <= dayOfYear);
}

/**
 * Manifest entries available after today: number > day-of-year, onboarding excluded.
 */
export async function getFutureEntries() {
  const today = new Date(Date.now());
  const dayOfYear = getDayOfYear(today);

  const manifest = await getPuzzleManifest();

  return manifest
    .filter((entry) => !entry.onboardingLevel)
    .filter((entry) => (entry.number ?? 0) > dayOfYear);
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

  const breakdown: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const entry of entries) {
    breakdown[entry.difficulty]++;
  }
  return breakdown;
}

/**
 * Gets the latest puzzle — the puzzle of the day
 */
export async function getLatestPuzzle() {
  const entries = await getAvailableEntries();
  const entry = entries[0];
  if (!entry) return null;
  return getPuzzle(entry.slug);
}

type GetRandomPuzzleOptions = {
  difficulty?: Difficulty[];
  excludeSlugs?: string[];
};

/**
 * Gets a random puzzle from the pool matching the given difficulty options.
 */
export async function getRandomPuzzle(options: GetRandomPuzzleOptions) {
  let entries = await getAvailableEntries();

  entries = entries
    .filter((puzzle) =>
      options.difficulty ? options.difficulty.includes(puzzle.difficulty) : true
    )
    .filter((puzzle) => !options.excludeSlugs?.includes(puzzle.slug));

  if (!entries.length) throw new Error("Unable to get random puzzle");

  const entry = entries[Math.floor(Math.random() * entries.length)];

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

  const next = manifest
    .filter((entry) => (entry.onboardingLevel ?? 0) > 1)
    .sort((a, b) => (a.onboardingLevel ?? 0) - (b.onboardingLevel ?? 0))
    .find((entry) => !lookup.has(entry.slug));

  return next ? getPuzzle(next.slug) : null;
}

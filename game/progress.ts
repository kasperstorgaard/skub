import type { PuzzleManifestEntry } from "#/game/types.ts";

/** A player's best move count per solved puzzle, by slug. */
export type Progress = Record<string, number>;

type Entry = Pick<PuzzleManifestEntry, "slug" | "number">;

// Unnumbered puzzles get fixed numbers far past the dailies; never reuse one.
const RESERVED_NUMBERS: Record<string, number> = {
  tutorial: 10_000,
  lars: 10_001,
  lone: 10_002,
  loke: 10_003,
};

// Move counts are stored in one byte, 0 meaning unsolved.
const MAX_MOVES = 255;

/** Best move count per puzzle from a list of solutions. */
export function getProgress(
  solutions: { puzzleSlug: string; moves: unknown[] }[],
): Progress {
  const progress: Progress = {};
  for (const { puzzleSlug, moves } of solutions) {
    const best = progress[puzzleSlug];
    if (best === undefined || moves.length < best) {
      progress[puzzleSlug] = moves.length;
    }
  }
  return progress;
}

/** Progress with a solve added, or the same object when it's no improvement. */
export function withSolve(
  progress: Progress,
  slug: string,
  moves: number,
): Progress {
  const best = progress[slug];
  if (best !== undefined && best <= moves) return progress;
  return { ...progress, [slug]: moves };
}

/**
 * Packs progress into one byte of best moves per puzzle number, 0 meaning
 * unsolved. Puzzles with neither a number nor a reserved one are dropped.
 */
export function encodeProgress(
  progress: Progress,
  entries: Entry[],
): Uint8Array {
  const numberBySlug = new Map(entries.map((e) => [e.slug, e.number]));
  const slots: number[] = [];

  for (const [slug, moves] of Object.entries(progress)) {
    const number = RESERVED_NUMBERS[slug] ?? numberBySlug.get(slug);
    if (number) slots[number] = Math.min(Math.max(moves, 1), MAX_MOVES);
  }

  return Uint8Array.from(slots, (moves) => moves ?? 0);
}

/** Reads bytes from {@link encodeProgress}, skipping numbers the manifest lacks. */
export function decodeProgress(bytes: Uint8Array, entries: Entry[]): Progress {
  const slugByNumber = new Map(entries.map((e) => [e.number, e.slug]));
  for (const [slug, number] of Object.entries(RESERVED_NUMBERS)) {
    slugByNumber.set(number, slug);
  }
  const progress: Progress = {};

  bytes.forEach((moves, number) => {
    const slug = moves ? slugByNumber.get(number) : undefined;
    if (slug) progress[slug] = moves;
  });

  return progress;
}

import type { PuzzleManifestEntry } from "#/game/types.ts";

/** A player's best move count per solved puzzle, by slug. */
export type Progress = Record<string, number>;

type Entry = Pick<PuzzleManifestEntry, "slug" | "number">;

// Unnumbered puzzles get fixed slots ahead of the dailies. Append only.
const RESERVED_SLUGS = ["tutorial", "lars", "lone", "loke"];

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
 * Packs progress into one byte of best moves per slot: the reserved slugs,
 * then one per daily number. Puzzles with neither are dropped.
 */
export function encodeProgress(
  progress: Progress,
  entries: Entry[],
): Uint8Array {
  const numberBySlug = new Map(entries.map((e) => [e.slug, e.number]));
  const slots: number[] = [];

  for (const [slug, moves] of Object.entries(progress)) {
    const slot = getSlot(slug, numberBySlug.get(slug));
    if (slot !== null) slots[slot] = Math.min(Math.max(moves, 1), MAX_MOVES);
  }

  return Uint8Array.from(slots, (moves) => moves ?? 0);
}

/** Reads bytes from {@link encodeProgress}, skipping numbers the manifest lacks. */
export function decodeProgress(bytes: Uint8Array, entries: Entry[]): Progress {
  const slugByNumber = new Map(entries.map((e) => [e.number, e.slug]));
  const progress: Progress = {};

  bytes.forEach((moves, slot) => {
    if (!moves) return;
    const slug = RESERVED_SLUGS[slot] ??
      slugByNumber.get(slot - RESERVED_SLUGS.length + 1);
    if (slug) progress[slug] = moves;
  });

  return progress;
}

function getSlot(slug: string, number?: number) {
  const reserved = RESERVED_SLUGS.indexOf(slug);
  if (reserved >= 0) return reserved;
  return number ? RESERVED_SLUGS.length + number - 1 : null;
}

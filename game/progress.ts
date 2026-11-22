import {
  decodeScoreKinds,
  encodeScoreKinds,
  type ScoreProgress,
} from "#/game/score.ts";
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
// Top bit of the score byte, clear of the score kinds' bits.
const RATED_BIT = 0x80;

/**
 * Best move count per puzzle from a list of solutions. Regular solves only:
 * Flash is a variant of its own, with its own shortest.
 */
export function getProgress(
  solutions: { puzzleSlug: string; moves: unknown[]; flash?: boolean }[],
): Progress {
  const progress: Progress = {};
  for (const { puzzleSlug, moves, flash } of solutions) {
    if (flash) continue;
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

/** Rated puzzles with one added, or the same array when it's already there. */
export function withRated(rated: string[], slug: string): string[] {
  return rated.includes(slug) ? rated : [...rated, slug];
}

type EncodeOptions = { score?: ScoreProgress; rated?: string[] };

/**
 * Packs progress into two bytes per puzzle number: best moves, 0 meaning
 * unsolved, then the solution score as bits plus a rated bit. Puzzles with
 * neither a number nor a reserved one are dropped.
 */
export function encodeProgress(
  progress: Progress,
  entries: Entry[],
  { score = {}, rated = [] }: EncodeOptions = {},
): Uint8Array {
  const numberBySlug = new Map(entries.map((e) => [e.slug, e.number]));
  const getSlot = (slug: string) =>
    RESERVED_NUMBERS[slug] ?? numberBySlug.get(slug);

  let length = 0;
  const slugs = [...Object.keys(progress), ...Object.keys(score), ...rated];
  for (const slug of slugs) {
    const number = getSlot(slug);
    if (number) length = Math.max(length, number + 1);
  }

  const bytes = new Uint8Array(length * 2);
  for (const [slug, moves] of Object.entries(progress)) {
    const number = getSlot(slug);
    if (number) bytes[number * 2] = Math.min(Math.max(moves, 1), MAX_MOVES);
  }
  for (const [slug, kinds] of Object.entries(score)) {
    const number = getSlot(slug);
    if (number) bytes[number * 2 + 1] = encodeScoreKinds(kinds);
  }
  for (const slug of rated) {
    const number = getSlot(slug);
    if (number) bytes[number * 2 + 1] |= RATED_BIT;
  }

  return bytes;
}

/** Reads bytes from {@link encodeProgress}, skipping numbers the manifest lacks. */
export function decodeProgress(
  bytes: Uint8Array,
  entries: Entry[],
): { progress: Progress; score: ScoreProgress; rated: string[] } {
  const slugByNumber = new Map(entries.map((e) => [e.number, e.slug]));
  for (const [slug, number] of Object.entries(RESERVED_NUMBERS)) {
    slugByNumber.set(number, slug);
  }
  const progress: Progress = {};
  const score: ScoreProgress = {};
  const rated: string[] = [];

  for (let number = 0; number * 2 < bytes.length; number++) {
    const slug = slugByNumber.get(number);
    if (!slug) continue;

    const moves = bytes[number * 2];
    const bits = bytes[number * 2 + 1] ?? 0;
    const kindBits = bits & ~RATED_BIT;
    if (moves) progress[slug] = moves;
    if (kindBits) score[slug] = decodeScoreKinds(kindBits);
    if (bits & RATED_BIT) rated.push(slug);
  }

  return { progress, score, rated };
}

/** Whether a puzzle is solved in either variant: a best, or any star. */
export function isSolved(
  slug: string,
  { progress, score }: { progress: Progress; score: ScoreProgress },
) {
  return slug in progress || (score[slug]?.length ?? 0) > 0;
}

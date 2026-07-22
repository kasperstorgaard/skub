import { formatPuzzle } from "#/game/formatter.ts";
import type { WallSpread } from "#/game/generator.ts";
import { parsePuzzle } from "#/game/parser.ts";
import type { Difficulty, Puzzle } from "#/game/types.ts";

/**
 * A generated puzzle candidate persisted to the local (gitignored) `generated/`
 * store for curation. It's a `Puzzle` plus the human feedback that labels it and
 * the generation options that produced it — the raw material the
 * `compare-generated` script diffs against the hand-built corpus. Not a real
 * corpus puzzle: it never enters the manifest or the game.
 */

/**
 * The local candidate store, relative to the project root (cwd). Gitignored and
 * kept out of `static/puzzles` so the manifest/corpus loader never picks
 * candidates up; also excluded from Vite's dev watcher (see vite.config.ts).
 */
export const GENERATED_DIR = "generated";

/**
 * Qualitative reasons a curator can tag a candidate with (all faults but
 * `nice`). Each maps loosely to a scoring metric the `compare-generated` report
 * tests: empty-areas → dead space, clumped → wall/blocker clustering,
 * too-easy/too-hard → the difficulty band, meh → the unremarkable middle.
 */
export const REASON_TAGS = [
  { value: "clumped", label: "Clumped" },
  { value: "empty-areas", label: "Empty areas" },
  { value: "too-easy", label: "Too easy" },
  { value: "too-hard", label: "Too hard" },
  { value: "meh", label: "Meh" },
  { value: "pretty", label: "Pretty" },
  { value: "nice", label: "Nice" },
] as const;

export type ReasonTag = typeof REASON_TAGS[number]["value"];

/** Valid tag values, for request validation. */
export const REASON_TAG_VALUES: readonly ReasonTag[] = REASON_TAGS.map((t) =>
  t.value
);

/** The generator settings a candidate was produced with (provenance). */
export type GenOptions = {
  difficulty: Difficulty;
  wallsRange: [number, number];
  blockersRange: [number, number];
  wallSpread: WallSpread;
  symmetry: number;
};

/** Human feedback on a candidate. All optional — a fresh candidate is unrated. */
export type Feedback = {
  /** 1–5 quality rating; absent until the curator rates it. */
  rating?: number;
  reasons?: ReasonTag[];
  note?: string;
};

export type GeneratedCandidate = Puzzle & Feedback & {
  genOptions?: GenOptions;
  /** Generator algorithm version that produced this board (e.g. "0.5"). */
  generatorVersion?: string;
};

/** How the UI references a stored candidate: identity plus its feedback. */
export type StoredCandidate = Feedback & { slug: string; name: string };

/**
 * Serializes a candidate to markdown. `formatPuzzle` stringifies every metadata
 * key it's given, so the feedback and `genOptions` fields round-trip through the
 * frontmatter alongside the standard puzzle metadata.
 */
export function formatGenerated(candidate: GeneratedCandidate): string {
  return formatPuzzle(candidate);
}

/** Parses a stored candidate back, feedback and provenance included. */
export function parseGenerated(markdown: string): GeneratedCandidate {
  return parsePuzzle(markdown) as GeneratedCandidate;
}

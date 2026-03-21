import { getPuzzle } from "#/game/loader.ts";
import { solveSync } from "#/game/solver.ts";
import { encodeState } from "#/game/url.ts";
import type { Move } from "#/game/types.ts";

export const TUTORIAL_PUZZLE_SLUG = "tutorial";

// First puzzle — Karla, the entry point for new users after the tutorial
const firstPuzzle = await getPuzzle("karla");
if (!firstPuzzle) throw new Error("karla puzzle not found");

export const FIRST_PUZZLE_SLUG = "karla";
export const FIRST_PUZZLE_NAME: string = firstPuzzle.name;
export const FIRST_PUZZLE_SOLUTION: Move[] = solveSync(firstPuzzle);
export const FIRST_PUZZLE_PARAM: string = encodeState({ moves: FIRST_PUZZLE_SOLUTION });

// Daily and archived puzzles are discovered at runtime by navigating to the
// page, reading the slug from the URL, then solving inline — see solve_test.ts.

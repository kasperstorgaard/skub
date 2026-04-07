import { Move, PuzzleStats, SkillLevel } from "#/game/types.ts";

export type { PuzzleStats };

export type User = {
  id: string;
  theme?: string;
  skillLevel: SkillLevel | null;
  email?: string;
  name?: string;
};

// Human entered solution for a puzzle
export type Solution = {
  id: string;
  puzzleSlug: string;
  name: string;
  moves: Move[];
  userId: string;
};

// One entry per canonical move group for a puzzle, maintained as best-effort aggregate
export type CanonicalGroup = {
  canonicalKey: string;
  firstSolution: Solution;
  count: number;
};

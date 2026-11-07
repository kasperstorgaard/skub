/**
 * Seeds local KV with solves of the last 10 daily puzzles by 10 fake users,
 * through the same saves, aggregates and awards as the solve POST, so the
 * solutions pages and the high score have something to show. Local only:
 * deno run -A ./scripts/seed-solves.ts
 *
 * Never run it with --tunnel. Each run adds more solves; the users stay the
 * same ten.
 */
import { awardScore } from "#/db/score.ts";
import { saveSolution, updateSolutionAggregates } from "#/db/solutions.ts";
import { setUser } from "#/db/user.ts";
import { getSlides, isValidSolution, resolveMoves } from "#/game/board.ts";
import { getPuzzleByDate } from "#/game/loader.ts";
import { getSolveScore } from "#/game/score.ts";
import { solveSync } from "#/game/solver.ts";
import type { Move, Puzzle } from "#/game/types.ts";

const USERS = [
  "Ada",
  "Bo",
  "Cleo",
  "Dag",
  "Elin",
  "Frode",
  "Gry",
  "Hugo",
  "Ida",
  "Jens",
].map((name, i) => ({
  id: `seed-${name.toLowerCase()}`,
  name,
  // Higher skill: solves more puzzles, with fewer detours.
  skill: 0.95 - i * 0.07,
}));

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** A few random moves that keep every piece on the board, then an optimal finish. */
function getSolve(puzzle: Puzzle, detours: number): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < detours; i++) {
    const board = resolveMoves(puzzle.board, moves);
    const options = board.pieces.flatMap((piece) =>
      Object.values(getSlides(piece, board))
        .filter((slide) => slide.outcome !== "dropped")
        .map((slide): Move => [{ x: piece.x, y: piece.y }, slide.target])
    );
    const move = options.length ? pick(options) : null;
    if (!move) break;
    moves.push(move);
    if (isValidSolution(resolveMoves(puzzle.board, moves))) return moves;
  }

  const board = resolveMoves(puzzle.board, moves);
  return [...moves, ...solveSync({ ...puzzle.board, pieces: board.pieces })];
}

const today = Temporal.Now.plainDateISO();
const puzzles: Puzzle[] = [];
for (let days = 9; days >= 0; days--) {
  const puzzle = await getPuzzleByDate(today.subtract({ days }));
  if (puzzle) puzzles.push(puzzle);
}

for (const user of USERS) {
  await setUser(user.id, { name: user.name, skillLevel: "intermediate" });
}

for (const puzzle of puzzles) {
  // A new order per puzzle, so first solves go to different players.
  const solvers = USERS.filter((user) => Math.random() < user.skill)
    .sort(() => Math.random() - 0.5);

  for (const user of solvers) {
    const detours = Math.random() < user.skill
      ? 0
      : 1 + Math.floor(Math.random() * 3);
    const moves = getSolve(puzzle, detours);
    if (!isValidSolution(resolveMoves(puzzle.board, moves))) {
      console.error(`${puzzle.slug} ${user.name}: no valid solve, skipped`);
      continue;
    }

    const { isNew, isNewPath, solution } = await saveSolution({
      puzzleSlug: puzzle.slug,
      name: user.name,
      moves,
      userId: user.id,
    });
    if (!isNew) continue;

    await updateSolutionAggregates(solution);
    const kinds = getSolveScore(puzzle, {
      moves: moves.length,
      isNewPath,
      flash: false,
    });
    const added = await awardScore(user.id, puzzle.slug, kinds);
    console.log(
      `${puzzle.slug} ${user.name}: ${moves.length} moves, +${
        added.join(", ") || "nothing"
      }`,
    );
  }
}

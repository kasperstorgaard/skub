// deno-lint-ignore-file skub-imports/use-hash-alias
import { PuzzlePage } from "../puzzles/[slug]/_e2e/puzzle-page.ts";
import { HighscorePage } from "./highscore-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { solvePuzzle } from "#/e2e/helpers.ts";

Deno.test("a player who solves a puzzle is on the all-time high score", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2erik" });
    const moves = await solvePuzzle("karla");
    const puzzlePage = await new PuzzlePage(page).goto("karla");
    await puzzlePage.solveByClicking(moves);
    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();

    const highscorePage = await new HighscorePage(page).goto("all");
    await expect(highscorePage.playerByName("e2erik")).toBeVisible();
  } finally {
    await teardown();
  }
});

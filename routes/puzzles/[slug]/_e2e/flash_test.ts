import { PuzzlePage } from "./puzzle-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { solveFlashPuzzle } from "#/e2e/helpers.ts";

Deno.test("a player solves a puzzle with Flash", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2eflash" });
    const moves = await solveFlashPuzzle("alice");
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.turnOnFlash();
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.dialogHeading).toBeVisible();
    // Flash solves are off the leaderboard: no way there from Flash
    await expect(puzzlePage.celebrationDialog.seeSolvesLink).toHaveCount(0);
    await expect(puzzlePage.seeSolvesLink).toHaveCount(0);
  } finally {
    await teardown();
  }
});

Deno.test("without JavaScript — a player solves a puzzle with Flash", async () => {
  const { page, teardown } = await setup({ javaScriptEnabled: false });
  try {
    const moves = await solveFlashPuzzle("alice");
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.turnOnFlash();
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.dialogHeading).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("without JavaScript — a Flash solve saves back to the puzzle, not the leaderboard", async () => {
  const { page, teardown } = await setup({ javaScriptEnabled: false });
  try {
    const moves = await solveFlashPuzzle("alice");
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.turnOnFlash();
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    await puzzlePage.solutionDialog.submitName("e2eflashnojs");

    await expect(page).toHaveURL(/\/puzzles\/alice\?/);
    await expect(page).not.toHaveURL(/\/solutions/);
  } finally {
    await teardown();
  }
});

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
  } finally {
    await teardown();
  }
});

Deno.test("a Flash solver finds their solve on the Flash tab", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    const user = await asUser({ name: "e2efie" });
    const moves = await solveFlashPuzzle("alice");
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.turnOnFlash();
    await puzzlePage.solveByClicking(moves);
    const solutionsPage = await puzzlePage.celebrationDialog.clickSeeSolves();

    await expect(solutionsPage.ownSolve(user.name)).toBeVisible();
  } finally {
    await teardown();
  }
});

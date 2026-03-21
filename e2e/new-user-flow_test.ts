import { expect, setup } from "./base.ts";
import { HomePage } from "#/e2e/pages/home-page.ts";

Deno.test("a new user discovers the tutorial, plays their first puzzle, and submits their name", async () => {
  const { page, teardown } = await setup();
  try {
    const home = await new HomePage(page).goto();
    const tutorial = await home.clickNewHereLink();

    await expect(tutorial.welcomeHeading).toBeVisible();
    await tutorial.clickNext();

    await expect(tutorial.piecesHeading).toBeVisible();
    await tutorial.clickShowMe();

    // Wait for the animation to complete
    await expect(tutorial.solutionHeading).toBeVisible({ timeout: 10_000 });
    await tutorial.clickLetsGo();

    const puzzlePage = await tutorial.clickWarmUpPuzzle();
    await puzzlePage.solveByClicking();

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    const solutions = await puzzlePage.solutionDialog.submitName("e2eddy");
    await expect(solutions.solveByName("e2eddy")).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a new user solves a puzzle using only the keyboard and submits their name", async () => {
  const { page, teardown } = await setup();

  try {
    const homePage = await new HomePage(page).goto();
    const puzzlePage = await homePage.clickDailyPuzzleLink();

    await expect(puzzlePage.heading).toBeVisible();
    await puzzlePage.solveByKeyboard();

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    const solutionsPage = await puzzlePage.solutionDialog.submitName("e2elba");
    await expect(solutionsPage.solveByName("e2elba")).toBeVisible();
  } finally {
    await teardown();
  }
});

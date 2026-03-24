// deno-lint-ignore skub-imports/use-hash-alias
import { HomePage } from "../routes/_e2e/home-page.ts";
import { expect, setup } from "./base.ts";

Deno.test("a new user discovers the tutorial, plays their first puzzle, and submits their name", async () => {
  const { page, teardown } = await setup();
  try {
    let home = await new HomePage(page).goto();
    const tutorial = await home.clickNewHereLink();

    await expect(tutorial.welcomeHeading).toBeVisible();
    await tutorial.clickNext();

    await expect(tutorial.piecesHeading).toBeVisible();
    await tutorial.clickTryIt();

    await tutorial.solveByClicking();

    await expect(tutorial.solvedHeading).toBeVisible();
    home = await tutorial.clickImReady();

    const puzzlePage = await home.clickWarmUpPuzzle();
    await puzzlePage.solveByClicking();

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    const solutions = await puzzlePage.solutionDialog.submitName("e2eddy");
    await expect(solutions.solveByName("e2eddy")).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("without JavaScript — a new user solves a puzzle and submits their name", async () => {
  const { page, teardown } = await setup({ javaScriptEnabled: false });
  try {
    const home = await new HomePage(page).goto();
    const puzzlePage = await home.clickDailyPuzzleLink();
    await puzzlePage.solveByClicking();

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    const solutions = await puzzlePage.solutionDialog.submitName("e2enora");
    await expect(solutions.solveByName("e2enora")).toBeVisible();
  } finally {
    await teardown();
  }
});

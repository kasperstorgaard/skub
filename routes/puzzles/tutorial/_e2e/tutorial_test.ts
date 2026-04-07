import { TutorialPage } from "./tutorial-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { solvePuzzle } from "#/e2e/helpers.ts";

Deno.test("tutorial — solves the puzzle by making moves", async () => {
  const { page, teardown } = await setup();
  try {
    const tutorial = await new TutorialPage(page).goto();

    await expect(tutorial.welcomeHeading).toBeVisible();
    await tutorial.clickNext();

    await expect(tutorial.piecesHeading).toBeVisible();
    await tutorial.clickTryIt();

    const moves = await solvePuzzle("tutorial");
    await tutorial.solveByClicking(moves);

    await expect(tutorial.solvedHeading).toBeVisible();
    await tutorial.clickImReady();

    await expect(page).toHaveURL(/\/$/);
  } finally {
    await teardown();
  }
});

Deno.test("tutorial — watches the replay instead of solving", async () => {
  const { page, teardown } = await setup();
  try {
    const tutorial = await new TutorialPage(page).goto();

    await expect(tutorial.welcomeHeading).toBeVisible();
    await tutorial.clickNext();

    await expect(tutorial.piecesHeading).toBeVisible();
    await tutorial.clickTryIt();

    // "Try it" closes the dialog and enters solve mode, showing "Show me" on the page
    await tutorial.clickShowMe();

    // Dialog fades in after the replay animation (~4s delay + some time to load)
    await expect(tutorial.solutionHeading).toBeVisible({ timeout: 10_000 });
    await tutorial.clickImReady();

    await expect(page).toHaveURL(/\/$/);
  } finally {
    await teardown();
  }
});

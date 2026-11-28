// deno-lint-ignore skub-imports/use-hash-alias
import { HomePage } from "../routes/_e2e/home-page.ts";
import { expect, setup } from "./base.ts";
import { solvePuzzle, uniqueName } from "./helpers.ts";

Deno.test("new user flow — a new user completes the tutorial", async () => {
  const { page, teardown } = await setup();
  try {
    let home = await new HomePage(page).goto();
    const tutorial = await home.clickNewHereLink();

    await tutorial.clickNext();
    await tutorial.clickTryIt();

    const moves = await solvePuzzle("tutorial");
    await tutorial.solveByClicking(moves);
    home = await tutorial.clickImReady();

    await expect(home.starterPuzzleLink).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("new user flow — a new user watches the tutorial replay", async () => {
  const { page, teardown } = await setup();
  try {
    let home = await new HomePage(page).goto();
    const tutorial = await home.clickNewHereLink();

    await tutorial.clickNext();
    await tutorial.clickTryIt();
    await tutorial.clickShowMe();

    // Dialog fades in after the replay animation
    await expect(tutorial.solutionHeading).toBeVisible({ timeout: 10_000 });
    home = await tutorial.clickImReady();

    await expect(home.starterPuzzleLink).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("without JavaScript — a new user solves a puzzle and submits their name", async () => {
  const { page, teardown } = await setup({ javaScriptEnabled: false });
  try {
    const home = await new HomePage(page).goto();
    const puzzlePage = await home.clickDailyPuzzleLink();
    const moves = await solvePuzzle(puzzlePage.currentSlug);
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    const name = uniqueName("e2enora");
    const solutions = await puzzlePage.solutionDialog.submitName(name);
    await expect(solutions.ownSolve(name)).toBeVisible();
  } finally {
    await teardown();
  }
});

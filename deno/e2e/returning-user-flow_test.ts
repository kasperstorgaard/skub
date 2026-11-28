// deno-lint-ignore skub-imports/use-hash-alias
import { HomePage } from "../routes/_e2e/home-page.ts";
import { expect, setup } from "./base.ts";
import { solvePuzzle } from "./helpers.ts";

// -- Returning user: homepage → daily puzzle → solve → celebration → home ---

Deno.test("a returning player opens the daily puzzle from the homepage and solves it", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    const user = await asUser({ name: "e2egg" });
    const homePage = await new HomePage(page).goto();

    const puzzlePage = await homePage.clickDailyPuzzleLink();
    const moves = await solvePuzzle(puzzlePage.currentSlug);
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();

    const solutionsPage = await puzzlePage.celebrationDialog
      .clickSeeSolutions();
    await expect(solutionsPage.ownSolve(user.name)).toBeVisible();

    // Back is a client-side navigation; wait for each page before going on
    await solutionsPage.backLink.click();
    await expect(puzzlePage.seeSolutionsLink).toBeVisible();
    await puzzlePage.backLink.click();
    await expect(homePage.heading).toBeVisible();
    await expect(homePage.dailyPuzzleLink.getByLabel("Perfect")).toBeVisible();
  } finally {
    await teardown();
  }
});

// -- No JavaScript: home → archives → earlier month → solve → submit name → archives ---

Deno.test("without js - a returning user plays an archived puzzle and submits their solve", async () => {
  const { page, asUser, teardown } = await setup({ javaScriptEnabled: false });
  try {
    const user = await asUser({ name: "e2elf" });

    const home = await new HomePage(page).goto();

    const archivesPage = await home.clickArchivesLink();
    await expect(archivesPage.heading).toBeVisible();

    // The 1st of last month is never today's puzzle.
    await archivesPage.clickPreviousMonth();
    await archivesPage.clickDay(1);

    const puzzlePage = await archivesPage.clickSelectedPuzzle();
    const moves = await solvePuzzle(puzzlePage.currentSlug);
    await puzzlePage.solveByClicking(moves);

    // No-JS named users go through SolutionDialog (pre-filled name) rather than
    // jumping straight to celebrate — one extra confirm click.
    await expect(puzzlePage.solutionDialog.heading).toBeVisible();

    const solutionsPage = await puzzlePage.solutionDialog.submitName(user.name);
    await expect(solutionsPage.ownSolve(user.name)).toBeVisible();

    await solutionsPage.backLink.click();
    await expect(puzzlePage.seeSolutionsLink).toBeVisible();
    await puzzlePage.backLink.click();
    await expect(archivesPage.heading).toBeVisible();
    await expect(archivesPage.day(1)).toHaveAccessibleName(
      /solved in \d+ moves/,
    );
  } finally {
    await teardown();
  }
});

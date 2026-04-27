// deno-lint-ignore skub-imports/use-hash-alias
import { HomePage } from "../routes/_e2e/home-page.ts";
import { expect, setup } from "./base.ts";
import { solvePuzzle } from "./helpers.ts";

// -- Returning user: homepage → daily puzzle → solve → celebration ---

Deno.test("a returning player opens the daily puzzle from the homepage and solves it", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2egg" });
    const homePage = await new HomePage(page).goto();

    const puzzlePage = await homePage.clickDailyPuzzleLink();
    const moves = await solvePuzzle(puzzlePage.currentSlug);
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();

    const solutionsPage = await puzzlePage.celebrationDialog.clickSeeSolves();
    await expect(solutionsPage.solveByName("e2egg")).toBeVisible();
  } finally {
    await teardown();
  }
});

// -- New user, no JavaScript: home → archives → earlier month → solve → submit name ---

Deno.test("without js - a returning user plays an archived puzzle and submits their solve", async () => {
  const { page, asUser, teardown } = await setup({ javaScriptEnabled: false });
  try {
    await asUser({ name: "e2elf" });

    const home = await new HomePage(page).goto();

    const archivesPage = await home.clickArchivesLink();
    await expect(archivesPage.heading).toBeVisible();

    // Navigate to the first available month so we're guaranteed a non-today puzzle.
    await archivesPage.clickMonth("Jan");
    await archivesPage.clickDay(1);

    const puzzlePage = await archivesPage.clickSelectedPuzzle();
    const moves = await solvePuzzle(puzzlePage.currentSlug);
    await puzzlePage.solveByClicking(moves);

    // No-JS named users go through SolutionDialog (pre-filled name) rather than
    // jumping straight to celebrate — one extra confirm click.
    await expect(puzzlePage.solutionDialog.heading).toBeVisible();

    const solutionsPage = await puzzlePage.solutionDialog.submitName("e2elf");
    await expect(solutionsPage.solveByName("e2elf")).toBeVisible();
  } finally {
    await teardown();
  }
});

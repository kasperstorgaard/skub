import { expect, setup } from "./base.ts";
import { HomePage } from "#/e2e/pages/home-page.ts";

// -- Returning user: homepage → daily puzzle → solve → celebration ---

Deno.test("a returning player opens the daily puzzle from the homepage and solves it", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser("e2egg");
    const home = await new HomePage(page).goto();

    const puzzlePage = await home.clickDailyPuzzleLink();
    await puzzlePage.solveByClicking();

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();
    await expect(puzzlePage.celebrationDialog.seeSolvesLink).toBeVisible();
  } finally {
    await teardown();
  }
});

// -- New user, no JavaScript: home → archives → page 2 → solve → submit name ---

Deno.test("without JavaScript — a new user plays an archived puzzle and submits their solve", async () => {
  const { page, teardown } = await setup({ javaScriptEnabled: false });
  try {
    const home = await new HomePage(page).goto();

    let archivesPage = await home.clickArchivesLink();
    await expect(archivesPage.heading).toBeVisible();

    archivesPage = await archivesPage.clickNextPage();

    const puzzlePage = await archivesPage.clickPuzzleAt(3);
    await puzzlePage.solveByClicking();

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    const solutions = await puzzlePage.solutionDialog.submitName("e2erlang");
    await expect(solutions.solveByName("e2erlang")).toBeVisible();
  } finally {
    await teardown();
  }
});

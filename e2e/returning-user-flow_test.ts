// deno-lint-ignore skub-imports/use-hash-alias
import { HomePage } from "../routes/_e2e/home-page.ts";
import { expect, setup } from "./base.ts";

// TODO: investigate CI failures — name not visible on solutions page after solve (deploy preview)

// -- Returning user: homepage → daily puzzle → solve → celebration ---

Deno.test({
  name:
    "a returning player opens the daily puzzle from the homepage and solves it",
  ignore: true,
  fn: async () => {
    const { page, asUser, teardown } = await setup();
    try {
      await asUser({ name: "e2egg" });
      const homePage = await new HomePage(page).goto();

      const puzzlePage = await homePage.clickDailyPuzzleLink();
      await puzzlePage.solveByClicking();

      await expect(puzzlePage.celebrationDialog.heading).toBeVisible();

      const solutionsPage = await puzzlePage.celebrationDialog.clickSeeSolves();
      await expect(solutionsPage.solveByName("e2egg")).toBeVisible();
    } finally {
      await teardown();
    }
  },
});

// -- New user, no JavaScript: home → archives → page 2 → solve → submit name ---

Deno.test("without js - a returning user plays an archived puzzle and submits their solve", async () => {
  const { page, asUser, teardown } = await setup({ javaScriptEnabled: false });
  try {
    await asUser({ name: "e2elf" });

    const home = await new HomePage(page).goto();

    let archivesPage = await home.clickArchivesLink();
    await expect(archivesPage.heading).toBeVisible();

    archivesPage = await archivesPage.clickNextPage();

    const puzzlePage = await archivesPage.clickPuzzleAt(3);
    await puzzlePage.solveByClicking();

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();

    const solutionsPage = await puzzlePage.celebrationDialog.clickSeeSolves();
    await expect(solutionsPage.solveByName("e2elf")).toBeVisible();
  } finally {
    await teardown();
  }
});

import { SolutionsPage } from "./solutions-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { solvePuzzle } from "#/e2e/helpers.ts";

const moves = await solvePuzzle("karla");

Deno.test("solutions page — shows a player's solve and links to replay", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    await asUser({ name: "e2ellie" });
    await addSolution({ puzzleSlug: "karla", moves });

    const solutionsPage = await new SolutionsPage(page).goto("karla");
    await expect(solutionsPage.solveByName("e2ellie")).toBeVisible();

    // Verify the Watch link navigates to a solution page
    await solutionsPage.clickWatchFirst();
    await expect(page).toHaveURL(/\/puzzles\/karla\/solutions\/.+/);
  } finally {
    await teardown();
  }
});

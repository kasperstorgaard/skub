import { ArchivesPage } from "./archives-page.ts";
import { expect, setup } from "#/e2e/base.ts";

Deno.test("archives — clicking the selected-day detail navigates to the puzzle", async () => {
  const { page, teardown } = await setup();
  try {
    const archivesPage = await new ArchivesPage(page).goto();
    await archivesPage.puzzleDays.first().click();
    await archivesPage.selectedPuzzleLink.click();
    await expect(page).toHaveURL(/\/(puzzles\/[^/]+|)$/);
  } finally {
    await teardown();
  }
});

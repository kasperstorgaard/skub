import { ArchivesPage } from "./archives-page.ts";
import { expect, setup } from "#/e2e/base.ts";

Deno.test("archives — renders the heading", async () => {
  const { page, teardown } = await setup();
  try {
    const archivesPage = await new ArchivesPage(page).goto();
    await expect(archivesPage.heading).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("archives — clicking a day selects it and populates the detail panel", async () => {
  const { page, teardown } = await setup();
  try {
    const archivesPage = await new ArchivesPage(page).goto();
    await archivesPage.puzzleDays.first().click();
    await expect(page).toHaveURL(/[?&]day=\d+/);
  } finally {
    await teardown();
  }
});

Deno.test("archives — clicking the selected-day detail navigates to the puzzle", async () => {
  const { page, teardown } = await setup();
  try {
    const archivesPage = await new ArchivesPage(page).goto();
    await archivesPage.puzzleDays.first().click();
    await archivesPage.selectedPuzzleLink.click();
    await expect(page).toHaveURL(/\/(puzzles\/.+|$)/);
  } finally {
    await teardown();
  }
});

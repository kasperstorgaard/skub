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

Deno.test("archives — navigates to the next page", async () => {
  const { page, teardown } = await setup();
  try {
    const archivesPage = await new ArchivesPage(page).goto();
    await archivesPage.clickNextPage();
    await expect(page).toHaveURL(/page=2/);
  } finally {
    await teardown();
  }
});

Deno.test("archives — puzzle card links to a puzzle page", async () => {
  const { page, teardown } = await setup();
  try {
    const archivesPage = await new ArchivesPage(page).goto();
    await archivesPage.clickPuzzleAt(1);
    await expect(page).toHaveURL(/\/puzzles\/.+/);
  } finally {
    await teardown();
  }
});

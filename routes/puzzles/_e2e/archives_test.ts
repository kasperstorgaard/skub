import { ArchivesPage } from "./archives-page.ts";
import { expect, setup } from "#/e2e/base.ts";

Deno.test("archives — clicking a card opens its puzzle", async () => {
  const { page, teardown } = await setup();
  try {
    const archivesPage = await new ArchivesPage(page).goto();
    await archivesPage.clickPuzzleCard();
    await expect(page).toHaveURL(/\/puzzles\/[^/?]+$/);
  } finally {
    await teardown();
  }
});

Deno.test("archives — without JS, the previous week link shows that week", async () => {
  const { page, teardown } = await setup({ javaScriptEnabled: false });
  try {
    // Wednesday 4 November 2026: the week before starts Monday 26 October
    const archivesPage = await new ArchivesPage(page).goto("?date=2026-11-04");
    await archivesPage.previousWeekLink.click();
    await expect(archivesPage.days.first()).toHaveId("2026-10-26");
  } finally {
    await teardown();
  }
});

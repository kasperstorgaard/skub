import { TutorialPage } from "./tutorial-page.ts";
import { expect, setup } from "#/e2e/base.ts";

Deno.test("tutorial — walks through all three dialog steps and dismisses", async () => {
  const { page, teardown } = await setup();
  try {
    const tutorial = await new TutorialPage(page).goto();

    await expect(tutorial.welcomeHeading).toBeVisible();
    await tutorial.clickNext();

    await expect(tutorial.piecesHeading).toBeVisible();
    await tutorial.clickShowMe();

    // Wait for the replay animation to complete before the dialog fades in
    await expect(tutorial.solutionHeading).toBeVisible({ timeout: 10_000 });
    await tutorial.clickLetsGo();

    // "Let's go" posts a form that redirects to the home page
    await expect(page).toHaveURL(/\/$/);
  } finally {
    await teardown();
  }
});

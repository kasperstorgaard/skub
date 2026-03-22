import { HomePage } from "./home-page.ts";
import { expect, setup } from "#/e2e/base.ts";

Deno.test("home — share button is visible", async () => {
  const { page, teardown } = await setup();
  try {
    const home = await new HomePage(page).goto();
    await expect(home.shareButton).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("home — profile link navigates to profile page", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const home = await new HomePage(page).goto();

    await home.profileLink.click();
    await expect(page).toHaveURL(/\/profile/);
  } finally {
    await teardown();
  }
});

Deno.test("home — daily puzzle card is visible", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const home = await new HomePage(page).goto();

    await expect(home.dailyPuzzleLink).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("home — archives link navigates to puzzles page", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const home = await new HomePage(page).goto();

    await home.clickArchivesLink();
    await expect(page).toHaveURL(/\/puzzles/);
  } finally {
    await teardown();
  }
});

Deno.test("home — random puzzle card is visible for returning user", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const home = await new HomePage(page).goto();

    await expect(home.randomPuzzleLink).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("home — tutorial link is shown for new user", async () => {
  const { page, teardown } = await setup();
  try {
    // No asUser() — fresh visitor gets onboarding: "new"
    const home = await new HomePage(page).goto();

    await expect(home.newHereLink).toBeVisible();
  } finally {
    await teardown();
  }
});

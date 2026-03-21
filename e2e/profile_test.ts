import { expect, setup } from "./base.ts";
import { ProfilePage } from "#/e2e/pages/profile-page.ts";

Deno.test("profile page — renders with heading", async () => {
  const { page, teardown } = await setup();
  try {
    const profilePage = await new ProfilePage(page).goto();

    await expect(profilePage.heading).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a signed-in player who visits their profile sees their saved username", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser("e2ezra");
    const profilePage = await new ProfilePage(page).goto();

    await expect(profilePage.usernameInput).toBeVisible();
    await expect(profilePage.usernameInput).toHaveValue("e2ezra");
  } finally {
    await teardown();
  }
});

import type { Page } from "playwright";

import { expect, setup } from "#/e2e/base.ts";
import { BASE_URL } from "#/e2e/helpers.ts";

class ProfilePage {
  constructor(private page: Page) {}

  get heading() {
    return this.page.getByRole("heading", { name: /Profile/i });
  }

  get usernameInput() {
    return this.page.getByRole("textbox", { name: /username/i });
  }

  async goto() {
    await this.page.goto(`${BASE_URL}/profile`);
    return this;
  }
}

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
    await asUser({ name: "e2ezra" });
    const profilePage = await new ProfilePage(page).goto();

    await expect(profilePage.usernameInput).toBeVisible();
    await expect(profilePage.usernameInput).toHaveValue("e2ezra");
  } finally {
    await teardown();
  }
});

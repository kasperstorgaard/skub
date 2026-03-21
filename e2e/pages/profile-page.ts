import type { Page } from "playwright";

import { BASE_URL } from "../helpers.ts";

export class ProfilePage {
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

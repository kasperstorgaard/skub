import type { Page } from "playwright";

import { BASE_URL } from "#/e2e/helpers.ts";

export class HighscorePage {
  constructor(private page: Page) {}

  async goto(period?: "all") {
    const query = period ? `?period=${period}` : "";
    await this.page.goto(`${BASE_URL}/highscore${query}`);
    return this;
  }

  playerByName(name: string) {
    return this.page.getByRole("main").getByText(name, { exact: true });
  }
}

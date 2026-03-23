import type { Page } from "playwright";

import { BASE_URL } from "#/e2e/helpers.ts";

export class SolutionPage {
  constructor(private page: Page) {}

  async goto(slug: string, solutionId: string) {
    await this.page.goto(
      `${BASE_URL}/puzzles/${slug}/solutions/${solutionId}`,
    );
    return this;
  }

  get heading() {
    return this.page.getByRole("heading", { level: 1 });
  }

  get puck() {
    return this.page.locator("a[id=p_1]");
  }

  get blockers() {
    return this.page.locator("a[id^=b_]");
  }

  get keyframes() {
    return this.page.locator("div[data-e2e=replay-keyframes] style");
  }

  get solvedByText() {
    return this.page.getByText("solved by");
  }
}

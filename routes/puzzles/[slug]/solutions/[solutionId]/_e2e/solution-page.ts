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
}

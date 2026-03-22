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

  get solvedByText() {
    return this.page.getByText("solved by");
  }

  // The <style> tag containing @keyframes for the replay animation
  get replayKeyframes() {
    return this.page.locator("style", { hasText: "@keyframes replay-" });
  }
}

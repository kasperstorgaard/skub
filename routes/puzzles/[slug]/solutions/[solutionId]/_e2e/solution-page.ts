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

  // The puck piece gets a replay-* animation when the Board island hydrates in replay mode
  get replayAnimation() {
    return this.page.locator("[style*='animation:replay-']").first();
  }

  // Check that @keyframes replay-* rules were injected into the page
  hasReplayKeyframes() {
    return this.page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (
              rule instanceof CSSKeyframesRule &&
              rule.name.startsWith("replay-")
            ) return true;
          }
        } catch { /* cross-origin sheets throw */ }
      }
      return false;
    });
  }
}

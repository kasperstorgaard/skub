import type { Page } from "playwright";

// deno-lint-ignore skub-imports/use-hash-alias
import { PuzzlePage } from "../../[slug]/_e2e/puzzle-page.ts";
import { BASE_URL } from "#/e2e/helpers.ts";

export class TutorialPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(`${BASE_URL}/puzzles/tutorial`);
    return this;
  }

  get heading() {
    return this.page.getByRole("heading", { name: /Tutorial/i });
  }

  get welcomeHeading() {
    return this.page.getByRole("heading", { name: /welcome to skub/i });
  }

  get piecesHeading() {
    return this.page.getByRole("heading", { name: /the pieces/i });
  }

  get solutionHeading() {
    return this.page.getByRole("heading", { name: /finding a solution/i });
  }

  async clickNext() {
    await this.page.getByRole("link", { name: /next/i }).click();
    return this;
  }

  async clickShowMe() {
    await this.page.getByRole("link", { name: /show me/i }).click();
    return this;
  }

  async clickLetsGo() {
    await this.page.getByRole("button", { name: /let's go!/i }).click();
    return this;
  }

  async clickWarmUpPuzzle() {
    await this.page.getByRole("link", { name: /warm-up puzzle/i }).click();
    return new PuzzlePage(this.page);
  }
}

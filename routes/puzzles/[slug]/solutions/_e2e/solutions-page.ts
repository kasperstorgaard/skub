// deno-lint-ignore-file skub-imports/use-hash-alias
import type { Page } from "playwright";

import { SolutionPage } from "../[solutionId]/_e2e/solution-page.ts";
import { BASE_URL } from "#/e2e/helpers.ts";

export class SolutionsPage {
  constructor(private page: Page) {}

  async goto(slug: string) {
    await this.page.goto(`${BASE_URL}/puzzles/${slug}/solutions`);
    return this;
  }

  get backLink() {
    return this.page.getByRole("link", { name: "Back", exact: true });
  }

  // By name, or as "you" once a path has more players than it names
  ownSolve(name: string) {
    const main = this.page.getByRole("main");
    return main.getByText(name, { exact: true })
      .or(main.getByText("you", { exact: true }));
  }

  async clickWatchFirst() {
    await this.page.getByRole("link", { name: /Watch/i }).first().click();
    return new SolutionPage(this.page);
  }
}

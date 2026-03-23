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

  solveByName(name: string) {
    return this.page.getByRole("link", { name, exact: false });
  }

  async clickWatchFirst() {
    await this.page.getByRole("link", { name: /Watch/i }).first().click();
    return new SolutionPage(this.page);
  }
}

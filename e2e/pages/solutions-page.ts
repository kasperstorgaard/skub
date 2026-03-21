import type { Page } from "playwright";

import { PuzzlePage } from "./puzzle-page.ts";

export class SolutionsPage {
  constructor(private page: Page) {}

  solveByName(name: string) {
    return this.page.getByText(name);
  }

  async clickWatchFirst() {
    await this.page.getByRole("link", { name: /Watch/i }).first().click();
    return new PuzzlePage(this.page);
  }
}

import type { Page } from "playwright";

import { PuzzlePage } from "./puzzle-page.ts";
import { BASE_URL } from "#/e2e/helpers.ts";

type GotoOptions = {
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
};

export class ArchivesPage {
  constructor(private page: Page) {}

  get heading() {
    return this.page.getByRole("heading", { name: /Archives/i });
  }

  async goto(pageNum = 1, opts?: GotoOptions) {
    await this.page.goto(`${BASE_URL}/puzzles?page=${pageNum}`, opts);
    return this;
  }

  async clickNextPage() {
    await this.page.getByRole("link", { name: "Next page" }).click();
    return this;
  }

  async clickPuzzleAt(position: number) {
    await this.page.getByRole("list").first()
      .getByRole("listitem").nth(position - 1)
      .getByRole("link").click();
    return new PuzzlePage(this.page);
  }
}

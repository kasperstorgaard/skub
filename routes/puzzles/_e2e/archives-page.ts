// deno-lint-ignore-file skub-imports/use-hash-alias
import type { Page } from "playwright";

import { PuzzlePage } from "../[slug]/_e2e/puzzle-page.ts";
import { BASE_URL } from "#/e2e/helpers.ts";

export class ArchivesPage {
  constructor(private page: Page) {}

  /** The month in view is the page's title. */
  get heading() {
    return this.page.getByRole("heading", { level: 1 });
  }

  /** The puzzle cards in the row. */
  get puzzleCards() {
    return this.page.locator("#archive-row a[href^='/puzzles/']");
  }

  /** The days rendered in the row, puzzle or not. */
  get days() {
    return this.page.locator("#archive-row [data-number]");
  }

  get previousWeekLink() {
    return this.page.getByRole("link", { name: "Previous week" });
  }

  async goto(
    search = "",
    opts?: Parameters<typeof this.page.goto>[1],
  ) {
    await this.page.goto(`${BASE_URL}/puzzles${search}`, opts);
    return this;
  }

  async clickPuzzleCard() {
    await this.puzzleCards.last().click();
    return new PuzzlePage(this.page);
  }
}

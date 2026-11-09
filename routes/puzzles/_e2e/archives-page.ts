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

  /** The calendar grid container. */
  get grid() {
    return this.page.locator(".grid-cols-7").first();
  }

  /** Days that have a puzzle (interactive day links). */
  get puzzleDays() {
    return this.grid.locator("a");
  }

  /** The puzzle card link shown in the detail panel after selecting a day. */
  get selectedPuzzleLink() {
    return this.page.locator(
      "section a[href^='/puzzles/'], section a[href='/']",
    ).first();
  }

  async goto(opts?: Parameters<typeof this.page.goto>[1]) {
    await this.page.goto(`${BASE_URL}/puzzles`, opts);
    return this;
  }

  /** A day cell in the calendar by its day-of-month number. */
  day(day: number) {
    return this.grid.locator("a", { hasText: new RegExp(`^${day}$`) })
      .first();
  }

  /** Clicks a day cell in the calendar by its day-of-month number. */
  async clickDay(day: number) {
    await this.day(day).click();
    return this;
  }

  /** Clicks the selected-day detail panel to navigate to the puzzle. */
  async clickSelectedPuzzle() {
    await this.selectedPuzzleLink.click();
    return new PuzzlePage(this.page);
  }

  /** Goes to the month before the one shown. */
  async clickPreviousMonth() {
    await this.page.getByRole("link", { name: /^Previous month/ }).click();
    return this;
  }
}

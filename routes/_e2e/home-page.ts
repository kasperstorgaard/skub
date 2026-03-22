// deno-lint-ignore-file skub-imports/use-hash-alias
import type { Page } from "playwright";

import { ArchivesPage } from "../puzzles/_e2e/archives-page.ts";
import { PuzzlePage } from "../puzzles/[slug]/_e2e/puzzle-page.ts";
import { TutorialPage } from "../puzzles/tutorial/_e2e/tutorial-page.ts";
import { BASE_URL } from "#/e2e/helpers.ts";

type GotoOptions = {
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
};

export class HomePage {
  constructor(private page: Page) {}

  async goto(opts?: GotoOptions) {
    await this.page.goto(BASE_URL, opts);
    return this;
  }

  get shareButton() {
    return this.page.getByRole("button", { name: /share/i });
  }

  get profileLink() {
    return this.page.getByRole("link", { name: /profile/i });
  }

  get dailyPuzzleLink() {
    return this.page.getByRole("link").filter({ hasText: /daily puzzle/i });
  }

  get randomPuzzleLink() {
    return this.page.getByRole("link").filter({ hasText: /random puzzle/i });
  }

  get newHereLink() {
    return this.page.getByRole("link", { name: /new here\?/i });
  }

  async clickNewHereLink() {
    await this.newHereLink.click();
    return new TutorialPage(this.page);
  }

  async clickDailyPuzzleLink() {
    await this.dailyPuzzleLink.click();
    return new PuzzlePage(this.page);
  }

  async clickWarmUpPuzzle() {
    await this.page.getByRole("link", { name: /warm-up puzzle/i }).click();
    return new PuzzlePage(this.page);
  }

  async clickArchivesLink() {
    await this.page.getByRole("link", { name: /archives/i }).click();
    return new ArchivesPage(this.page);
  }
}

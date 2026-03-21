import type { Page } from "playwright";

import { BASE_URL } from "../helpers.ts";
import { ArchivesPage } from "./archives-page.ts";
import { PuzzlePage } from "./puzzle-page.ts";
import { TutorialPage } from "./tutorial-page.ts";

type GotoOptions = {
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
};

export class HomePage {
  constructor(private page: Page) {}

  async goto(opts?: GotoOptions) {
    await this.page.goto(BASE_URL, opts);
    return this;
  }

  async clickNewHereLink() {
    await this.page.getByRole("link", { name: /new here\?/i }).click();
    return new TutorialPage(this.page);
  }

  async clickDailyPuzzleLink() {
    await this.page.getByRole("link").filter({ hasText: /daily puzzle/i }).click();
    return new PuzzlePage(this.page);
  }

  async clickArchivesLink() {
    await this.page.getByRole("link", { name: /archives/i }).click();
    return new ArchivesPage(this.page);
  }
}

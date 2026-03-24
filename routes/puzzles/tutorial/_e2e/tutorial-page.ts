// deno-lint-ignore-file skub-imports/use-hash-alias
import type { Page } from "playwright";

import { HomePage } from "../../../_e2e/home-page.ts";
import { BASE_URL } from "#/e2e/helpers.ts";
import { getPuzzle } from "#/game/loader.ts";
import { solveSync } from "#/game/solver.ts";

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

  get solvedHeading() {
    return this.page.getByRole("heading", { name: /you found a solution/i });
  }

  async clickNext() {
    await this.page.getByRole("link", { name: /next/i }).click();
    return this;
  }

  async clickTryIt() {
    await this.page.getByRole("link", { name: /try it/i }).click();
    return this;
  }

  async clickShowMe() {
    await this.page.getByRole("link", { name: /show me/i }).click();
    return this;
  }

  async clickImReady() {
    await this.page.getByRole("link", { name: /i'm ready/i }).click();
    return new HomePage(this.page);
  }

  async solveByClicking() {
    const puzzle = await getPuzzle("tutorial");
    if (!puzzle) throw new Error("Tutorial puzzle not found");

    // Wait for the DOM to be fully loaded — solve mode is entered client-side
    // so event listeners may not be attached yet
    await this.page.waitForLoadState("domcontentloaded");

    for (const move of solveSync(puzzle)) {
      await this.page.getByRole("link", {
        name: `at ${move[0].x},${move[0].y}`,
      }).click();
      await this.page.getByRole("link", {
        name: `move to ${move[1].x},${move[1].y}`,
      }).click();
    }
    return this;
  }
}

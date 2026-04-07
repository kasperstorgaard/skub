// deno-lint-ignore-file skub-imports/use-hash-alias
import type { Page } from "playwright";

import { SolutionsPage } from "../solutions/_e2e/solutions-page.ts";
import { BASE_URL } from "#/e2e/helpers.ts";
import type { Move } from "#/game/types.ts";

const SLUG_MATCHER = /\/puzzles\/([^/]+)(\/|$)/i;

export class PuzzlePage {
  constructor(private page: Page) {}

  get currentSlug() {
    return (new URL(this.page.url()).pathname.match(SLUG_MATCHER) ?? [])[1];
  }

  get heading() {
    return this.page.getByRole("heading", { level: 1 });
  }

  // Shown after a guest solves a puzzle
  get solutionDialog() {
    const page = this.page;
    return {
      heading: page.getByRole("heading", { name: /Nice solve!/i }),
      usernameInput: page.getByRole("textbox", { name: /username/i }),
      submitName: async (name: string) => {
        await page.getByRole("textbox", { name: /username/i }).fill(name);
        await page.getByRole("button", { name: /Claim your solve/i }).click();
        return new SolutionsPage(page);
      },
    };
  }

  // Shown after a signed-in player solves a puzzle
  get celebrationDialog() {
    const page = this.page;
    const dialog = page.getByRole("dialog");
    return {
      heading: dialog.getByRole("heading"),
      body: dialog.locator("p"),
      seeSolvesLink: dialog.getByRole("link", { name: /See solves/i }),
      clickSeeSolves: async () => {
        await dialog.getByRole("link", { name: /See solves/i }).click();
        return new SolutionsPage(page);
      },
    };
  }

  get tutorialNudge() {
    return this.page.getByRole("link", { name: /learn the basics/i });
  }

  async goto(slug: string, opts?: Parameters<typeof this.page.goto>[1]) {
    await this.page.goto(`${BASE_URL}/puzzles/${slug}`, opts);
    return this;
  }

  async solveByClicking(moves: Move[]) {
    // Wait for the dom to be fully loaded, as this relies on event listeners to attach.
    await this.page.waitForLoadState("domcontentloaded");

    for (const move of moves) {
      await this.page.getByRole("link", {
        name: `at ${move[0].x},${move[0].y}`,
      }).click();
      await this.page.getByRole("link", {
        name: `move to ${move[1].x},${move[1].y}`,
      }).click();
    }
    return this;
  }

  async solveByKeyboard(moves: Move[]) {
    // Wait for the dom to be fully loaded, as this relies on event listeners to attach.
    // Use waitForLoadState (idempotent) rather than waitForEvent (fires once, already gone if page loaded before this call).
    await this.page.waitForLoadState("domcontentloaded");

    // Loop over moves, focus the piece, then use arrow keys to move
    for (const [from, to] of moves) {
      const fromLabel = `at ${from.x},${from.y}`;
      const toLabel = `move to ${to.x},${to.y}`;

      await this.page.getByRole("link", { name: fromLabel }).focus();

      // Wait for the guide to appear before pressing the arrow key
      await this.page.getByRole("link", { name: toLabel }).waitFor();

      const key = to.x > from.x
        ? "ArrowRight"
        : to.x < from.x
        ? "ArrowLeft"
        : to.y > from.y
        ? "ArrowDown"
        : "ArrowUp";

      // Move the piece in the right direction with arrow keys
      await this.page.keyboard.press(key);
    }

    return this;
  }
}

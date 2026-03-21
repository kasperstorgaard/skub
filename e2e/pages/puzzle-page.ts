// deno-lint-ignore-file skub-imports/use-hash-alias
import type { Page } from "playwright";

import { BASE_URL } from "../helpers.ts";
import { SolutionsPage } from "./solutions-page.ts";
import { getPuzzle } from "#/game/loader.ts";
import { solveSync } from "#/game/solver.ts";
import { encodeState } from "#/game/url.ts";
import { expect } from "../base.ts";

const SLUG_MATCHER = /\/puzzles\/([^/]+)(\/|$)/i;

type GotoOptions = {
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
};

export class PuzzlePage {
  constructor(private page: Page) {}

  get currentSlug() {
    return (new URL(this.page.url()).pathname.match(SLUG_MATCHER) ?? [])[1];
  }

  async goto(slug: string, opts?: GotoOptions) {
    await this.page.goto(`${BASE_URL}/puzzles/${slug}`, opts);
    return this;
  }

  async gotoWithSolution(slug: string, opts?: GotoOptions) {
    const puzzle = await getPuzzle(slug);
    if (!puzzle) throw new Error(`Puzzle not found: ${slug}`);
    const param = encodeState({ moves: solveSync(puzzle) });
    await this.page.goto(`${BASE_URL}/puzzles/${slug}?${param}`, opts);
    return this;
  }

  async solveByClicking() {
    const puzzle = await getPuzzle(this.currentSlug);
    if (!puzzle) throw new Error(`Puzzle not found: ${this.currentSlug}`);
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

  async solveByKeyboard() {
    const puzzle = await getPuzzle(this.currentSlug);
    if (!puzzle) throw new Error(`Puzzle not found: ${this.currentSlug}`);

    for (const [from, to] of solveSync(puzzle)) {
      const fromLabel = `at ${from.x},${from.y}`;
      const target = this.page.getByRole("link", { name: fromLabel });

      // Wait for the piece to be present — previous move may still be resolving.
      await target.waitFor();

      let tabCount = 0;
      while (tabCount++ < 30) {
        await this.page.keyboard.press("Tab");

        const label = await this.page.evaluate(
          `document.activeElement?.getAttribute('aria-label') ?? ''`,
        ) as string;
        if (label.includes(fromLabel)) break;
      }

      await expect(target).toBeFocused();

      // TODO: locally, focusing a piece re-renders with the guide via onFocus —
      // investigate why Enter is needed here but not in manual testing.
      await this.page.keyboard.press("Enter");

      // Need to wait for loaded, or the arrow key later will be fired into the void
      await this.page.waitForLoadState("domcontentloaded");

      const toLabel = `move to ${to.x},${to.y}`;
      await expect(this.page.getByRole("link", { name: toLabel }))
        .toBeVisible();

      const key = to.x > from.x
        ? "ArrowRight"
        : to.x < from.x
        ? "ArrowLeft"
        : to.y > from.y
        ? "ArrowDown"
        : "ArrowUp";

      await this.page.keyboard.press(key);
    }

    return this;
  }

  get heading() {
    return this.page.getByRole("heading", { level: 1 });
  }

  get solvedByText() {
    return this.page.getByText("solved by");
  }

  // Shown after a guest solves a puzzle
  get solutionDialog() {
    const page = this.page;
    return {
      heading: page.getByRole("heading", { name: /Nice solve!/i }),
      usernameInput: page.getByRole("textbox", { name: /username/i }),
      submitName: async (name: string) => {
        await page.getByRole("textbox", { name: /username/i }).fill(name);
        await page.getByRole("button", { name: /Post your solve/i }).click();
        return new SolutionsPage(page);
      },
    };
  }

  // Shown after a signed-in player solves a puzzle
  get celebrationDialog() {
    const page = this.page;
    const dialog = page.getByRole("dialog");
    return {
      heading: dialog.getByRole("heading", { name: /Solved in/i }),
      seeSolvesLink: dialog.getByRole("link", { name: /See solves/i }),
      clickSeeSolves: async () => {
        await dialog.getByRole("link", { name: /See solves/i }).click();
        return new SolutionsPage(page);
      },
    };
  }
}

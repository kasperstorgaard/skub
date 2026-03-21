// deno-lint-ignore-file skub-imports/use-hash-alias
import type { Page } from "playwright";

import { BASE_URL } from "../helpers.ts";
import { SolutionsPage } from "./solutions-page.ts";
import { getPuzzle } from "#/game/loader.ts";
import { solveSync } from "#/game/solver.ts";
import { encodeState } from "#/game/url.ts";

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

    // Wait for the dom to be fully loaded, as this relies on event listeners to attach.
    // Use waitForLoadState (idempotent) rather than waitForEvent (fires once, already gone if page loaded before this call).
    await this.page.waitForLoadState("domcontentloaded");

    // Loop over moves, focus the piece, then use arrow keys to move
    for (const [from, to] of solveSync(puzzle)) {
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

// TODO: test editor toolbar interactions (place wall/blocker/puck via toolbar + board click)
import type { Page } from "playwright";

import { expect, setup } from "#/e2e/base.ts";
import { BASE_URL } from "#/e2e/helpers.ts";

class EditorPage {
  constructor(private page: Page) {}

  get heading() {
    return this.page.getByRole("heading", { level: 1 });
  }

  get editNameButton() {
    return this.page.getByRole("button", { name: /edit name/i });
  }

  get nameSpan() {
    return this.heading.locator("[contenteditable]");
  }

  get guideLink() {
    return this.page.getByRole("link", { name: /how to add puzzles/i });
  }

  async goto() {
    await this.page.goto(`${BASE_URL}/puzzles/new`);
    return this;
  }
}

Deno.test("editor — renders with editable name heading", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const editor = await new EditorPage(page).goto();

    await expect(editor.heading).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("editor — editing the name updates the heading", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const editor = await new EditorPage(page).goto();

    await editor.nameSpan.click();
    await editor.nameSpan.selectText();
    await page.keyboard.type("My Puzzle");
    await page.keyboard.press("Tab");

    await expect(editor.heading).toHaveText(/My Puzzle/);
  } finally {
    await teardown();
  }
});

Deno.test("editor — guide link points to contribute page", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const editor = await new EditorPage(page).goto();

    await expect(editor.guideLink).toHaveAttribute("href", "/contribute");
  } finally {
    await teardown();
  }
});

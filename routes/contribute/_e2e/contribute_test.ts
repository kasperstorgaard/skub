import { expect, setup } from "#/e2e/base.ts";
import { BASE_URL } from "#/e2e/helpers.ts";

Deno.test("contribute page — renders heading and link to puzzle editor", async () => {
  const { page, teardown } = await setup();
  try {
    await page.goto(`${BASE_URL}/contribute`);

    await expect(
      page.getByRole("heading", { name: /how to add a new puzzle/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /\/puzzles\/new/i }),
    ).toBeVisible();
  } finally {
    await teardown();
  }
});

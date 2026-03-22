import { chromium } from "playwright";
import type { Page } from "playwright";

import { addUserCookie, clearTestUser, seedNamedUser } from "./helpers.ts";

type ContextOptions = {
  javaScriptEnabled?: boolean;
};

export type Fixtures = {
  page: Page;
  asUser: (name: string) => Promise<void>;
  teardown: () => Promise<void>;
};

export async function setup(opts?: ContextOptions): Promise<Fixtures> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    javaScriptEnabled: opts?.javaScriptEnabled ?? true,
  });

  const page = await context.newPage();
  // Remote CI (Deno Deploy previews) is slow — use a longer timeout than the
  // Playwright default of 30s only when running locally for faster feedback.
  const isLocal = !Deno.env.get("BASE_URL")?.startsWith("https://");
  page.setDefaultTimeout(isLocal ? 5_000 : 15_000);

  return {
    page,
    get asUser() {
      return async (name: string) => {
        const userId = crypto.randomUUID();
        await seedNamedUser(userId, name);
        await addUserCookie(context, userId);
      };
    },
    teardown: async () => {
      const cookies = await context.cookies();
      const userId = cookies.find((c) => c.name === "user_id")?.value;
      if (userId) await clearTestUser(userId);
      await context.close();
      await browser.close();
    },
  };
}

export { expect } from "playwright/test";

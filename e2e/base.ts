import { chromium } from "playwright";
import type { Page } from "playwright";

import {
  addUserCookie,
  clearTestUser,
  seedSolution,
  seedUser,
  type SeedUserInput,
} from "./helpers.ts";
import type { Solution, User } from "#/db/types.ts";

type ContextOptions = {
  javaScriptEnabled?: boolean;
};

// puzzleSlug + moves are required; name and userId default from the current user
type AddSolutionInput = Omit<Solution, "id" | "name" | "userId"> & {
  name?: string;
  userId?: string;
};

export type Fixtures = {
  page: Page;
  asUser: (input: SeedUserInput) => Promise<User>;
  addSolution: (input: AddSolutionInput) => Promise<Solution>;
  teardown: () => Promise<void>;
};

// Numbers each test's trace; tests run one at a time
let traceCount = 0;

export async function setup(opts?: ContextOptions): Promise<Fixtures> {
  const browser = await chromium.launch({
    args: ["--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    javaScriptEnabled: opts?.javaScriptEnabled ?? true,
  });
  await context.tracing.start({ screenshots: true, snapshots: true });

  const page = await context.newPage();

  let currentUser: User | undefined;

  return {
    page,
    async asUser(input: SeedUserInput) {
      const user = await seedUser(input);
      await addUserCookie(context, user.id);
      currentUser = user;
      return user;
    },
    async addSolution(input: AddSolutionInput) {
      if (!currentUser?.name) {
        throw new Error("Call asUser() before addSolution()");
      }
      const solution = await seedSolution({
        name: currentUser.name,
        userId: currentUser.id,
        ...input,
      });
      // Seeding skips the app, so drop the stale cookie to force a rebuild.
      await context.clearCookies({ name: "progress" });
      return solution;
    },
    teardown: async () => {
      // Clean up the seeded user, or fall back to the cookie for users
      // created through the app UI (e.g. new-user flow tests).
      const userId = currentUser?.id ??
        (await context.cookies()).find((c) => c.name === "user_id")?.value;
      if (userId) await clearTestUser(userId);

      // Printed under the test's own output, so a failure names its trace
      traceCount++;
      const tracePath = `test-results/trace-${
        String(traceCount).padStart(2, "0")
      }.zip`;
      await context.tracing.stop({ path: tracePath });
      console.log(`trace: ${tracePath}`);

      await context.close();
      await browser.close();
    },
  };
}

export { expect } from "playwright/test";

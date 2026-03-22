import { chromium } from "playwright";
import type { Page } from "playwright";

import {
  addUserCookie,
  BASE_URL,
  clearTestUser,
  seedSolution,
  seedUser,
  type SeedUserInput,
} from "./helpers.ts";
import type { Solution, User } from "#/db/types.ts";

const isRemote = !BASE_URL.includes("localhost");

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

export async function setup(opts?: ContextOptions): Promise<Fixtures> {
  const browser = await chromium.launch({
    args: ["--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    javaScriptEnabled: opts?.javaScriptEnabled ?? true,
  });

  const page = await context.newPage();

  // Deploy previews are slower than localhost — give actions and assertions more room
  if (isRemote) {
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(15_000);
  }

  let currentUser: User | undefined;

  return {
    page,
    async asUser(input: SeedUserInput) {
      const user = await seedUser(input);
      await addUserCookie(context, user.id);
      currentUser = user;
      return user;
    },
    addSolution(input: AddSolutionInput) {
      if (!currentUser?.name) {
        throw new Error("Call asUser() before addSolution()");
      }
      return seedSolution({
        name: currentUser.name,
        userId: currentUser.id,
        ...input,
      });
    },
    teardown: async () => {
      if (currentUser) await clearTestUser(currentUser.id);
      await context.close();
      await browser.close();
    },
  };
}

import { expect as baseExpect } from "playwright/test";

export const expect = isRemote
  ? baseExpect.configure({ timeout: 15_000 })
  : baseExpect;

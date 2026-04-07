import { HomePage } from "./home-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { solvePuzzle } from "#/e2e/helpers.ts";
import { getAvailableEntries } from "#/game/loader.ts";

Deno.test("home — share button is visible", async () => {
  const { page, teardown } = await setup();
  try {
    const home = await new HomePage(page).goto();
    await expect(home.shareButton).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("home — profile link navigates to profile page", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const home = await new HomePage(page).goto();

    await home.profileLink.click();
    await expect(page).toHaveURL(/\/profile/);
  } finally {
    await teardown();
  }
});

Deno.test("home — daily puzzle link navigates to a puzzle", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const home = await new HomePage(page).goto();

    await home.dailyPuzzleLink.click();
    await expect(page).toHaveURL(/\/puzzles\//);
  } finally {
    await teardown();
  }
});

Deno.test("home — archives link navigates to puzzles page", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma" });
    const home = await new HomePage(page).goto();

    await home.clickArchivesLink();
    await expect(page).toHaveURL(/\/puzzles/);
  } finally {
    await teardown();
  }
});

Deno.test("home — random puzzle link navigates to a puzzle", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emma", skillLevel: "intermediate" });
    const home = await new HomePage(page).goto();

    await home.randomPuzzleLink.click();
    await expect(page).toHaveURL(/\/puzzles\//);
  } finally {
    await teardown();
  }
});

Deno.test("home — tutorial link navigates to tutorial for new user", async () => {
  const { page, teardown } = await setup();
  try {
    const home = await new HomePage(page).goto();

    await home.newHereLink.click();
    await expect(page).toHaveURL(/\/puzzles\/tutorial/);
  } finally {
    await teardown();
  }
});

Deno.test("home — shows starter puzzle for a user who completed tutorial", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2emil", skillLevel: "beginner" });
    const home = await new HomePage(page).goto();

    await expect(home.starterPuzzleLink).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("home — shows quick puzzle for user in who completed first onboarding puzzle after tutorial", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    await asUser({ name: "e2ene", skillLevel: "beginner" });
    await addSolution({ puzzleSlug: "lars", moves: await solvePuzzle("lars") });
    const home = await new HomePage(page).goto();

    await expect(home.quickPuzzleLink).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("home — stats show streak and solve count after solving first daily", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    const [_, entries] = await Promise.all([
      asUser({ name: "e2elmer" }),
      getAvailableEntries(),
    ]);

    for (const entry of entries.slice(0, 1)) {
      await addSolution({
        puzzleSlug: entry.slug,
        moves: await solvePuzzle(entry.slug),
      });
    }

    const homePage = await new HomePage(page).goto();

    await expect(homePage.stat("Streak")).toContainText("1 / 1");
    await expect(homePage.stat("Solves")).toContainText("1");
    await expect(homePage.stat("Perfect")).toContainText("1 / 100%");
  } finally {
    await teardown();
  }
});

Deno.test("home — stats show streak and solve count after solving multiple dailies", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    const [_, entries] = await Promise.all([
      asUser({ name: "e2estrid" }),
      getAvailableEntries(),
    ]);

    for (const entry of entries.slice(0, 3)) {
      await addSolution({
        puzzleSlug: entry.slug,
        moves: await solvePuzzle(entry.slug),
      });
    }

    const homePage = await new HomePage(page).goto();

    await expect(homePage.stat("Streak")).toContainText("3 / 3");
    await expect(homePage.stat("Solves")).toContainText("3");
    await expect(homePage.stat("Perfect")).toContainText("3 / 100%");
  } finally {
    await teardown();
  }
});

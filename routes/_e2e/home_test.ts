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
    await asUser({ name: "e2emma" });
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

Deno.test("home — stats show streak and solve count after seeding solutions", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    const [_, entries] = await Promise.all([
      asUser({ name: "e2estats" }),
      getAvailableEntries(),
    ]);

    for (const entry of entries.slice(0, 2)) {
      await addSolution({
        puzzleSlug: entry.slug,
        moves: await solvePuzzle(entry.slug),
      });
    }

    const homePage = await new HomePage(page).goto();

    await expect(homePage.stat("Streak")).toContainText("2");
    await expect(homePage.stat("Solves")).toContainText("2");
  } finally {
    await teardown();
  }
});

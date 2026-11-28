import { HomePage } from "./home-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { solvePuzzle } from "#/e2e/helpers.ts";
import { getAvailableEntries } from "#/game/loader.ts";

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

Deno.test("home — stats show the streak after solving several dailies", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    const [_, entries] = await Promise.all([
      asUser({ name: "e2estrid" }),
      getAvailableEntries(),
    ]);

    // This process is dev, so the list carries the whole schedule; only
    // released puzzles count toward a streak on the server.
    const released = entries.filter((entry) => !entry.isFuture);

    for (const entry of released.slice(0, 3)) {
      await addSolution({
        puzzleSlug: entry.slug,
        moves: await solvePuzzle(entry.slug),
      });
    }

    const homePage = await new HomePage(page).goto();

    await expect(homePage.stat("Streak")).toHaveText("3");
  } finally {
    await teardown();
  }
});

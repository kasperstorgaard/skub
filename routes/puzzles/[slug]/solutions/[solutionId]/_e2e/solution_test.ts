import { SolutionPage } from "./solution-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { getPuzzle } from "#/game/loader.ts";
import { solveSync } from "#/game/solver.ts";

const puzzle = await getPuzzle("karla");
if (!puzzle) throw new Error("Puzzle not found: karla");
const moves = solveSync(puzzle);

Deno.test("solution page — shows the puzzle name in the heading", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    await asUser({ name: "e2esme" });
    const solution = await addSolution({ puzzleSlug: "karla", moves });
    const solutionPage = await new SolutionPage(page).goto(
      "karla",
      solution.id,
    );
    await expect(solutionPage.heading).toHaveText(/Karla/);
  } finally {
    await teardown();
  }
});

Deno.test("solution page — shows who solved it", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    await asUser({ name: "e2esme" });
    const solution = await addSolution({ puzzleSlug: "karla", moves });
    const solutionPage = await new SolutionPage(page).goto(
      "karla",
      solution.id,
    );
    await expect(solutionPage.solvedByText).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("solution page — plays the replay animation", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    await asUser({ name: "e2esme" });
    const solution = await addSolution({ puzzleSlug: "karla", moves });
    const solutionPage = await new SolutionPage(page).goto(
      "karla",
      solution.id,
    );
    // Board island hydrates in replay mode, injecting @keyframes and applying them to pieces
    await expect(solutionPage.replayAnimation).toBeAttached({ timeout: 10_000 });
    expect(await solutionPage.hasReplayKeyframes()).toBe(true);
  } finally {
    await teardown();
  }
});

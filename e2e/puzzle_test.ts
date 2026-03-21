import { expect, setup } from "./base.ts";
import { PuzzlePage } from "#/e2e/pages/puzzle-page.ts";

// -- Completing a puzzle as a returning player ---

Deno.test("a returning player who solves a puzzle sees the celebration dialog", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser("e2eliza");
    const puzzlePage = await new PuzzlePage(page).gotoWithSolution("karla");

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();
    await expect(puzzlePage.celebrationDialog.seeSolvesLink).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("without JavaScript — a returning player sees the celebration dialog", async () => {
  const { page, asUser, teardown } = await setup({ javaScriptEnabled: false });
  try {
    await asUser("e2edith");
    const puzzlePage = await new PuzzlePage(page).gotoWithSolution(
      "karla",
      { waitUntil: "domcontentloaded" },
    );

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a returning player sees the celebration dialog when submitting a duplicate solve", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser("e2elsa");
    let puzzlePage = await new PuzzlePage(page).gotoWithSolution("karla");

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();
    puzzlePage = await new PuzzlePage(page).gotoWithSolution("karla");

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();
    await expect(puzzlePage.celebrationDialog.seeSolvesLink).toBeVisible();
  } finally {
    await teardown();
  }
});

// -- Completing a puzzle as a new player ---

Deno.test("a new player who solves a puzzle using the keyboard is prompted to save their solve", async () => {
  const { page, teardown } = await setup();
  try {
    const puzzlePage = await new PuzzlePage(page).goto("karla");
    await puzzlePage.solveByKeyboard();

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a new player who completes a puzzle is prompted to save their solve", async () => {
  const { page, teardown } = await setup();
  try {
    const puzzlePage = await new PuzzlePage(page).gotoWithSolution("karla");

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    await expect(puzzlePage.solutionDialog.usernameInput).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a new player who submits their name is taken to the solutions page and can watch a replay", async () => {
  const { page, teardown } = await setup();
  try {
    const puzzlePage = await new PuzzlePage(page).gotoWithSolution("karla");
    const solutions = await puzzlePage.solutionDialog.submitName("e2edward");

    await expect(solutions.solveByName("e2edward")).toBeVisible();

    const replayPage = await solutions.clickWatchFirst();
    await expect(replayPage.heading).toBeVisible();
    await expect(replayPage.solvedByText).toBeVisible();
  } finally {
    await teardown();
  }
});

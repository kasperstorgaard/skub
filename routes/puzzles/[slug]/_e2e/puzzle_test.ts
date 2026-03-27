import { PuzzlePage } from "./puzzle-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { solvePuzzle } from "#/e2e/helpers.ts";

// -- Completing a puzzle as a returning player ---

Deno.test("a returning player who solves a puzzle sees the celebration dialog", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2eliza" });
    const moves = await solvePuzzle("karla");
    const puzzlePage = await new PuzzlePage(page).goto("karla");
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.celebrationDialog.heading).toBeVisible();
    await expect(puzzlePage.celebrationDialog.seeSolvesLink).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("without JavaScript — a returning player submits their solve via the solution dialog", async () => {
  const { page, asUser, teardown } = await setup({ javaScriptEnabled: false });
  try {
    await asUser({ name: "e2edith" });
    const moves = await solvePuzzle("karla");
    const puzzlePage = await new PuzzlePage(page).goto("karla");
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    const solutionsPage = await puzzlePage.solutionDialog.submitName("e2edith");
    await expect(solutionsPage.solveByName("e2edith")).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a returning player sees the celebration dialog when submitting a duplicate solve", async () => {
  const { page, asUser, addSolution, teardown } = await setup();
  try {
    await asUser({ name: "e2elsa" });
    const moves = await solvePuzzle("karla");
    await addSolution({ puzzleSlug: "karla", moves });
    const puzzlePage = await new PuzzlePage(page).goto("karla");
    await puzzlePage.solveByClicking(moves);

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
    const moves = await solvePuzzle("karla");
    const puzzlePage = await new PuzzlePage(page).goto("karla");
    await puzzlePage.solveByClicking(moves);

    await expect(puzzlePage.solutionDialog.heading).toBeVisible();
    await expect(puzzlePage.solutionDialog.usernameInput).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a new player who submits their name is taken to the solutions page", async () => {
  const { page, teardown } = await setup();
  try {
    const moves = await solvePuzzle("karla");
    const puzzlePage = await new PuzzlePage(page).goto("karla");
    await puzzlePage.solveByClicking(moves);
    await puzzlePage.solutionDialog.submitName("e2edward");

    await expect(page).toHaveURL(/\/puzzles\/karla\/solutions/);
  } finally {
    await teardown();
  }
});

import { PuzzlePage } from "./puzzle-page.ts";
import { expect, setup } from "#/e2e/base.ts";
import { solvePuzzle } from "#/e2e/helpers.ts";

// The server plays the head start from the same solver as solvePuzzle, so the
// rest of the game is the solution after it. alice: 8 moves, 2 played.

Deno.test("turning on Flash explains it first", async () => {
  const { page, teardown } = await setup();
  try {
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.flashSwitch.click();

    await expect(puzzlePage.flashDialog.heading).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("accepting Flash starts the puzzle with the head start played", async () => {
  const { page, teardown } = await setup();
  try {
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.flashSwitch.click();
    await puzzlePage.flashDialog.turnOn();

    await expect(puzzlePage.moveCount("02")).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("Flash stays on once accepted", async () => {
  const { page, teardown } = await setup();
  try {
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.flashSwitch.click();
    await puzzlePage.flashDialog.turnOn();

    await expect(puzzlePage.flashSwitch).toHaveAttribute(
      "aria-checked",
      "true",
    );
  } finally {
    await teardown();
  }
});

Deno.test("starting over with Flash on goes back to the head start", async () => {
  const { page, teardown } = await setup();
  try {
    const moves = await solvePuzzle("alice");
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.flashSwitch.click();
    await puzzlePage.flashDialog.turnOn();
    await puzzlePage.solveByClicking(moves.slice(2, 3));
    await puzzlePage.startOverLink.click();

    await expect(puzzlePage.moveCount("02")).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("undo stops at the Flash head start", async () => {
  const { page, teardown } = await setup();
  try {
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.flashSwitch.click();
    await puzzlePage.flashDialog.turnOn();
    await puzzlePage.undoLink.click();

    await expect(puzzlePage.moveCount("02")).toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a new player who solves with Flash isn't asked for a name", async () => {
  const { page, teardown } = await setup();
  try {
    const moves = await solvePuzzle("alice");
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.flashSwitch.click();
    await puzzlePage.flashDialog.turnOn();
    await puzzlePage.solveByClicking(moves.slice(2));

    await expect(puzzlePage.flashSolvedDialog.heading).toBeVisible();
    await expect(puzzlePage.flashSolvedDialog.usernameInput).not.toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("a returning player's Flash solve stays off the leaderboard", async () => {
  const { page, asUser, teardown } = await setup();
  try {
    await asUser({ name: "e2eflash" });
    const moves = await solvePuzzle("laerke");
    const puzzlePage = await new PuzzlePage(page).goto("laerke");
    await puzzlePage.flashSwitch.click();
    await puzzlePage.flashDialog.turnOn();
    await puzzlePage.solveByClicking(moves.slice(2));
    await expect(puzzlePage.flashSolvedDialog.heading).toBeVisible();
    await page.keyboard.press("Escape");
    const solutionsPage = await puzzlePage.clickSeeSolves();

    await expect(solutionsPage.solveByName("e2eflash")).not.toBeVisible();
  } finally {
    await teardown();
  }
});

Deno.test("without JavaScript — a player turns on Flash and solves", async () => {
  const { page, teardown } = await setup({ javaScriptEnabled: false });
  try {
    const moves = await solvePuzzle("alice");
    const puzzlePage = await new PuzzlePage(page).goto("alice");
    await puzzlePage.flashSwitch.click();
    await puzzlePage.flashDialog.turnOn();
    await puzzlePage.solveByClicking(moves.slice(2));

    await expect(puzzlePage.flashSolvedDialog.heading).toBeVisible();
  } finally {
    await teardown();
  }
});

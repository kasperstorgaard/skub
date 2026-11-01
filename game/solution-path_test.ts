import { assertEquals } from "@std/assert";

import { getSolutionSteps } from "./solution-path.ts";
import type { Board } from "#/game/types.ts";

const empty: Board = {
  destination: { x: 7, y: 7 },
  pieces: [],
  walls: [],
  holes: [],
  portals: [],
};

Deno.test("getSolutionSteps() should tag each move with the piece that made it", () => {
  const board: Board = {
    ...empty,
    pieces: [
      { x: 0, y: 0, type: "puck" },
      { x: 3, y: 7, type: "blocker" },
    ],
  };

  const steps = getSolutionSteps(board, [
    [{ x: 3, y: 7 }, { x: 7, y: 7 }],
    [{ x: 0, y: 0 }, { x: 0, y: 7 }],
  ]);

  assertEquals(steps.map((step) => step.piece), ["blocker", "puck"]);
});

Deno.test("getSolutionSteps() should replay earlier moves before resolving the next", () => {
  const board: Board = {
    ...empty,
    pieces: [
      { x: 0, y: 0, type: "puck" },
      { x: 5, y: 3, type: "blocker" },
    ],
  };

  // The blocker drops to the bottom row, then the puck stops against it.
  const steps = getSolutionSteps(board, [
    [{ x: 5, y: 3 }, { x: 5, y: 7 }],
    [{ x: 0, y: 0 }, { x: 0, y: 7 }],
    [{ x: 0, y: 7 }, { x: 4, y: 7 }],
  ]);

  assertEquals(steps.length, 3);
  assertEquals(steps[2].segments[0].at(-1), { x: 4, y: 7 });
});

Deno.test("getSolutionSteps() should split a teleporting slide into one leg per portal", () => {
  const board: Board = {
    ...empty,
    pieces: [{ x: 0, y: 2, type: "puck" }],
    portals: [{ x: 3, y: 2 }, { x: 6, y: 5 }],
  };

  const [step] = getSolutionSteps(board, [
    [{ x: 0, y: 2 }, { x: 7, y: 5 }, { x: 3, y: 2 }],
  ]);

  assertEquals(step.segments.length, 2);
  assertEquals(step.segments[0].at(-1), { x: 3, y: 2 });
  assertEquals(step.segments[1][0], { x: 6, y: 5 });
});

Deno.test("getSolutionSteps() should mark a move that ends in a hole as dropped", () => {
  const board: Board = {
    ...empty,
    pieces: [
      { x: 0, y: 0, type: "puck" },
      { x: 2, y: 4, type: "blocker" },
    ],
    holes: [{ x: 2, y: 6 }],
  };

  const [step] = getSolutionSteps(board, [[{ x: 2, y: 4 }, { x: 2, y: 6 }]]);

  assertEquals(step.outcome, "dropped");
});

Deno.test("getSolutionSteps() should stop at the first move the board no longer allows", () => {
  const board: Board = {
    ...empty,
    pieces: [{ x: 0, y: 0, type: "puck" }],
  };

  const steps = getSolutionSteps(board, [
    [{ x: 0, y: 0 }, { x: 7, y: 0 }],
    // The puck is no longer on A1, so this move is stale.
    [{ x: 0, y: 0 }, { x: 0, y: 7 }],
  ]);

  assertEquals(steps.length, 1);
});

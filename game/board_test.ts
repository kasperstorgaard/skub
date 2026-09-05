import { assertEquals, assertThrows } from "@std/assert";

import {
  BoardError,
  flipBoard,
  getGrid,
  getSlide,
  getTargets,
  isBoardSame,
  isLooped,
  isMoveSame,
  isPositionSame,
  isValidMove,
  isValidSolution,
  resolveMoves,
  rotateBoard,
  validateBoard,
} from "./board.ts";
import { Piece, Position } from "#/game/types.ts";

/*
 <irony>Prettiest test in all the land</irony>
 context: I don't like logic in tests, so we keep it stupid and long instead.
*/
Deno.test("getGrid() should return a ROWSxCOLS grid of positions", () => {
  const result = getGrid();

  assertEquals(result, [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
      { x: 7, y: 0 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 6, y: 1 },
      { x: 7, y: 1 },
    ],
    [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 6, y: 2 },
      { x: 7, y: 2 },
    ],
    [
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
      { x: 6, y: 3 },
      { x: 7, y: 3 },
    ],
    [
      { x: 0, y: 4 },
      { x: 1, y: 4 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 7, y: 4 },
    ],
    [
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ],
    [
      { x: 0, y: 6 },
      { x: 1, y: 6 },
      { x: 2, y: 6 },
      { x: 3, y: 6 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 7, y: 6 },
    ],
    [
      { x: 0, y: 7 },
      { x: 1, y: 7 },
      { x: 2, y: 7 },
      { x: 3, y: 7 },
      { x: 4, y: 7 },
      { x: 5, y: 7 },
      { x: 6, y: 7 },
      { x: 7, y: 7 },
    ],
  ]);
});

Deno.test("isPositionSame() should be true for identical positions", () => {
  assertEquals(
    isPositionSame({ x: 0, y: 0 }, { x: 0, y: 0 }),
    true,
  );
  assertEquals(
    isPositionSame({ x: 6, y: 6 }, { x: 6, y: 6 }),
    true,
  );
});

Deno.test("isPositionSame() should be false for different positions", () => {
  assertEquals(
    isPositionSame({ x: 7, y: 5 }, { x: 5, y: 7 }),
    false,
  );
  assertEquals(
    isPositionSame({ x: 5, y: 7 }, { x: 0, y: 7 }),
    false,
  );
});

Deno.test("isMoveSame() should compare both positions of a move", () => {
  assertEquals(
    isMoveSame([{ x: 3, y: 3 }, { x: 3, y: 0 }], [{ x: 3, y: 3 }, {
      x: 3,
      y: 0,
    }]),
    true,
  );
  assertEquals(
    isMoveSame([{ x: 3, y: 3 }, { x: 3, y: 0 }], [{ x: 3, y: 3 }, {
      x: 7,
      y: 3,
    }]),
    false,
  );
  assertEquals(
    isMoveSame([{ x: 3, y: 3 }, { x: 3, y: 0 }], [{ x: 5, y: 5 }, {
      x: 3,
      y: 0,
    }]),
    false,
  );
});

Deno.test("isBoardSame() should ignore the order pieces and walls are listed in", () => {
  assertEquals(
    isBoardSame({
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [
        { x: 2, y: 2, orientation: "vertical" },
        { x: 4, y: 6, orientation: "horizontal" },
      ],
    }, {
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 5, y: 5, type: "blocker" },
        { x: 1, y: 1, type: "puck" },
      ],
      walls: [
        { x: 4, y: 6, orientation: "horizontal" },
        { x: 2, y: 2, orientation: "vertical" },
      ],
    }),
    true,
  );
});

Deno.test("isBoardSame() should be false for boards differing by one wall", () => {
  assertEquals(
    isBoardSame({
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [
        { x: 2, y: 2, orientation: "vertical" },
        { x: 4, y: 6, orientation: "horizontal" },
      ],
    }, {
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [
        { x: 2, y: 2, orientation: "vertical" },
        { x: 4, y: 6, orientation: "horizontal" },
        { x: 6, y: 6, orientation: "vertical" },
      ],
    }),
    false,
  );
});

Deno.test("isBoardSame() should be false for boards differing by wall orientation", () => {
  assertEquals(
    isBoardSame({
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [{ x: 2, y: 2, orientation: "vertical" }],
    }, {
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [{ x: 2, y: 2, orientation: "horizontal" }],
    }),
    false,
  );
});

Deno.test("isBoardSame() should be false for boards differing only in destination", () => {
  assertEquals(
    isBoardSame({
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [{ x: 2, y: 2, orientation: "vertical" }],
    }, {
      holes: [],
      portals: [],
      destination: { x: 4, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [{ x: 2, y: 2, orientation: "vertical" }],
    }),
    false,
  );
});

Deno.test("isBoardSame() should be false when the puck and a blocker swap roles", () => {
  assertEquals(
    isBoardSame({
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [],
    }, {
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "blocker" },
        { x: 5, y: 5, type: "puck" },
      ],
      walls: [],
    }),
    false,
  );
});

Deno.test("isBoardSame() should be false for a mirrored board", () => {
  // A mirror is a different layout to play, unlike the canonical hash the
  // novelty gate uses, which folds the dihedral symmetries together.
  assertEquals(
    isBoardSame({
      holes: [],
      portals: [],
      destination: { x: 3, y: 3 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 5, y: 5, type: "blocker" },
      ],
      walls: [{ x: 2, y: 2, orientation: "vertical" }],
    }, {
      holes: [],
      portals: [],
      destination: { x: 4, y: 3 },
      pieces: [
        { x: 6, y: 1, type: "puck" },
        { x: 2, y: 5, type: "blocker" },
      ],
      walls: [{ x: 5, y: 2, orientation: "vertical" }],
    }),
    false,
  );
});

Deno.test("getTargets() should return {} for an empty space", () => {
  const result = getTargets({ x: 4, y: 4 }, {
    holes: [],
    portals: [],
    walls: [],
    pieces: [],
  });

  assertEquals(result, {});
});

Deno.test("getTargets() should get 4 positions for a center source", () => {
  const targets = getTargets({ x: 3, y: 5 }, {
    holes: [],
    portals: [],
    walls: [],
    pieces: [{ type: "puck", x: 3, y: 5 }],
  });

  assertEquals(
    targets,
    {
      up: { x: 3, y: 0 },
      right: { x: 7, y: 5 },
      down: { x: 3, y: 7 },
      left: { x: 0, y: 5 },
    },
  );
});

Deno.test("getTargets() should ignore itself", () => {
  const targets = getTargets({ x: 3, y: 5 }, {
    holes: [],
    portals: [],
    walls: [],
    pieces: [{ x: 3, y: 5, type: "puck" }],
  });

  assertEquals(
    targets,
    {
      up: { x: 3, y: 0 },
      right: { x: 7, y: 5 },
      down: { x: 3, y: 7 },
      left: { x: 0, y: 5 },
    },
  );
});

Deno.test("getTargets() walls should end targets", () => {
  const targets = getTargets({ x: 6, y: 6 }, {
    holes: [],
    portals: [],
    walls: [
      { x: 6, y: 4, orientation: "horizontal" },
    ],
    pieces: [{ x: 6, y: 6, type: "puck" }],
  });

  assertEquals(
    targets,
    {
      up: { x: 6, y: 4 },
      right: { x: 7, y: 6 },
      down: { x: 6, y: 7 },
      left: { x: 0, y: 6 },
    },
  );
});

Deno.test("getTargets() should respect multiple walls", () => {
  const targets = getTargets({ x: 3, y: 4 }, {
    holes: [],
    portals: [],
    walls: [
      { x: 3, y: 4, orientation: "horizontal" },
      { x: 6, y: 4, orientation: "horizontal" },
      { x: 5, y: 4, orientation: "vertical" },
      { x: 3, y: 4, orientation: "vertical" },
    ],
    pieces: [{ x: 3, y: 4, type: "puck" }],
  });

  assertEquals(targets, {
    right: { x: 4, y: 4 },
    down: { x: 3, y: 7 },
  });
});

Deno.test("getTargets() should use the closest wall to src", () => {
  const targets = getTargets({ x: 2, y: 7 }, {
    holes: [],
    portals: [],
    walls: [
      { x: 2, y: 4, orientation: "horizontal" },
      { x: 2, y: 6, orientation: "horizontal" },
    ],
    pieces: [{ x: 2, y: 7, type: "puck" }],
  });

  assertEquals(
    targets,
    {
      up: { x: 2, y: 6 },
      right: { x: 7, y: 7 },
      left: { x: 0, y: 7 },
    },
  );
});

Deno.test("getTargets() is not affected by not non-aligned walls", () => {
  const targets = getTargets({ x: 4, y: 5 }, {
    holes: [],
    portals: [],
    walls: [
      { x: 5, y: 6, orientation: "horizontal" },
      { x: 1, y: 3, orientation: "horizontal" },
      { x: 6, y: 6, orientation: "horizontal" },
      { x: 5, y: 2, orientation: "vertical" },
      { x: 1, y: 3, orientation: "vertical" },
      { x: 2, y: 6, orientation: "vertical" },
    ],
    pieces: [{ x: 4, y: 5, type: "puck" }],
  });

  assertEquals(
    targets,
    {
      up: { x: 4, y: 0 },
      right: { x: 7, y: 5 },
      down: { x: 4, y: 7 },
      left: { x: 0, y: 5 },
    },
  );
});

Deno.test("getTargets() pieces should end targets", () => {
  const targets = getTargets({ x: 6, y: 6 }, {
    holes: [],
    portals: [],
    walls: [],
    pieces: [
      { x: 6, y: 4, type: "puck" },
      { x: 6, y: 6, type: "blocker" },
    ],
  });

  assertEquals(
    targets,
    {
      up: { x: 6, y: 5 },
      right: { x: 7, y: 6 },
      down: { x: 6, y: 7 },
      left: { x: 0, y: 6 },
    },
  );
});

Deno.test("getTargets() is not affected by non-aligned pieces", () => {
  const targets = getTargets({ x: 6, y: 6 }, {
    holes: [],
    portals: [],
    walls: [],
    pieces: [
      { x: 6, y: 6, type: "puck" },
      { x: 5, y: 4, type: "blocker" },
      { x: 1, y: 3, type: "blocker" },
      { x: 5, y: 2, type: "blocker" },
      { x: 1, y: 3, type: "blocker" },
      { x: 2, y: 4, type: "blocker" },
    ],
  });

  assertEquals(
    targets,
    {
      up: { x: 6, y: 0 },
      right: { x: 7, y: 6 },
      down: { x: 6, y: 7 },
      left: { x: 0, y: 6 },
    },
  );
});

Deno.test("getTargets() should respect both pieces and walls", () => {
  const targets = getTargets({ x: 3, y: 6 }, {
    holes: [],
    portals: [],
    walls: [
      { x: 3, y: 7, orientation: "horizontal" },
      { x: 3, y: 4, orientation: "horizontal" },
      { x: 6, y: 6, orientation: "vertical" },
    ],
    pieces: [
      { x: 3, y: 6, type: "puck" },
      { x: 3, y: 4, type: "blocker" },
      { x: 3, y: 2, type: "blocker" },
      { x: 0, y: 6, type: "blocker" },
    ],
  });

  assertEquals(targets, {
    up: { x: 3, y: 5 },
    right: { x: 5, y: 6 },
    left: { x: 1, y: 6 },
  });
});

Deno.test("getTargets() should not overlap with pieces a)", () => {
  const targets = getTargets({ x: 3, y: 4 }, {
    holes: [],
    portals: [],
    pieces: [
      { x: 3, y: 4, type: "puck" },
    ],
    walls: [
      { x: 3, y: 4, orientation: "vertical" },
      { x: 3, y: 4, orientation: "horizontal" },
    ],
  });

  assertEquals(
    targets,
    {
      right: { x: 7, y: 4 },
      down: { x: 3, y: 7 },
    },
  );
});

Deno.test("getTargets() should not overlap with pieces b)", () => {
  const targets = getTargets({ x: 6, y: 7 }, {
    holes: [],
    portals: [],
    pieces: [
      { x: 6, y: 7, type: "puck" },
      { x: 7, y: 7, type: "blocker" },
    ],
    walls: [],
  });

  assertEquals(
    targets,
    {
      up: { x: 6, y: 0 },
      left: { x: 0, y: 7 },
    },
  );
});

Deno.test("validateBoard() should throw with an empty board", () => {
  assertThrows(() => {
    validateBoard({
      destination: null as unknown as Position,
      pieces: [],
      walls: [],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with no pieces", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [],
      walls: [{ x: 1, y: 2, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with invalid pieces", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 2, y: 4 } as unknown as Piece],
      walls: [{ x: 1, y: 2, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with no puck", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 4, y: 1, type: "blocker" }],
      walls: [{ x: 1, y: 2, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with multiple pucks", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [
        { x: 4, y: 1, type: "puck" },
        { x: 2, y: 5, type: "puck" },
      ],
      walls: [{ x: 1, y: 2, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with destination out of bounds", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 8 },
      pieces: [{ x: 4, y: 1, type: "puck" }],
      walls: [{ x: 1, y: 2, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with piece out of bounds", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 12, y: 1, type: "puck" }],
      walls: [{ x: 1, y: 2, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with wall out of bounds", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 0, y: 1, type: "puck" }],
      walls: [{ x: 1, y: 90, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with redundant edge wall (horizontal y=0)", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 0, y: 1, type: "puck" }],
      walls: [{ x: 3, y: 0, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with redundant edge wall (vertical x=0)", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 0, y: 1, type: "puck" }],
      walls: [{ x: 0, y: 3, orientation: "vertical" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with identical pieces", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 4, y: 1, type: "puck" }, { x: 4, y: 1, type: "puck" }],
      walls: [{ x: 1, y: 2, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with identical piece positions", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 4, y: 1, type: "blocker" }, { x: 4, y: 1, type: "puck" }],
      walls: [{ x: 1, y: 2, orientation: "horizontal" }],
    });
  }, BoardError);
});

Deno.test("validateBoard() should throw with identical walls", () => {
  assertThrows(() => {
    validateBoard({
      destination: { x: 0, y: 3 },
      pieces: [{ x: 4, y: 1, type: "puck" }],
      walls: [
        { x: 1, y: 2, orientation: "horizontal" },
        { x: 1, y: 2, orientation: "horizontal" },
      ],
    });
  }, BoardError);
});

Deno.test("validateBoard() should return board for valid simple board", () => {
  const result = validateBoard({
    destination: { x: 0, y: 3 },
    pieces: [{ x: 4, y: 1, type: "puck" }],
    walls: [{ x: 1, y: 2, orientation: "horizontal" }],
  });

  assertEquals(result, {
    holes: [],
    portals: [],
    destination: { x: 0, y: 3 },
    pieces: [{ x: 4, y: 1, type: "puck" }],
    walls: [{ x: 1, y: 2, orientation: "horizontal" }],
  });
});

Deno.test("validateBoard() should return board for valid complex board", () => {
  const result = validateBoard({
    destination: { x: 2, y: 3 },
    pieces: [
      { x: 4, y: 1, type: "puck" },
      { x: 2, y: 1, type: "blocker" },
      { x: 3, y: 2, type: "blocker" },
      { x: 2, y: 5, type: "blocker" },
      { x: 3, y: 6, type: "blocker" },
      { x: 4, y: 4, type: "blocker" },
    ],
    walls: [
      { x: 1, y: 2, orientation: "horizontal" },
      { x: 1, y: 2, orientation: "vertical" },
      { x: 4, y: 3, orientation: "horizontal" },
      { x: 0, y: 6, orientation: "horizontal" },
      { x: 5, y: 1, orientation: "vertical" },
      { x: 1, y: 6, orientation: "horizontal" },
    ],
  });

  assertEquals(result, {
    holes: [],
    portals: [],
    destination: { x: 2, y: 3 },
    pieces: [
      { x: 4, y: 1, type: "puck" },
      { x: 2, y: 1, type: "blocker" },
      { x: 3, y: 2, type: "blocker" },
      { x: 2, y: 5, type: "blocker" },
      { x: 3, y: 6, type: "blocker" },
      { x: 4, y: 4, type: "blocker" },
    ],
    walls: [
      { x: 1, y: 2, orientation: "horizontal" },
      { x: 1, y: 2, orientation: "vertical" },
      { x: 4, y: 3, orientation: "horizontal" },
      { x: 0, y: 6, orientation: "horizontal" },
      { x: 5, y: 1, orientation: "vertical" },
      { x: 1, y: 6, orientation: "horizontal" },
    ],
  });
});

Deno.test("isValidMove() should return false for move not matching a piece", () => {
  const result = isValidMove([
    { x: 3, y: 1 },
    { x: 6, y: 3 },
  ], {
    holes: [],
    portals: [],
    pieces: [
      { x: 4, y: 1, type: "puck" },
    ],
    walls: [],
  });

  assertEquals(result, false);
});

Deno.test("isValidMove() should return false for diagonal move", () => {
  const result = isValidMove([
    { x: 4, y: 1 },
    { x: 6, y: 3 },
  ], {
    holes: [],
    portals: [],
    pieces: [
      { x: 4, y: 1, type: "puck" },
    ],
    walls: [],
  });

  assertEquals(result, false);
});

Deno.test("isValidMove() should return false for blocked move", () => {
  const result = isValidMove([
    { x: 4, y: 1 },
    { x: 6, y: 1 },
  ], {
    holes: [],
    portals: [],
    pieces: [{ x: 4, y: 1, type: "puck" }],
    walls: [{ x: 5, y: 1, orientation: "vertical" }],
  });

  assertEquals(result, false);
});

Deno.test("resolveMoves() should return the intial board with an empty list", () => {
  const result = resolveMoves({
    holes: [],
    portals: [],
    pieces: [{ x: 4, y: 1, type: "puck" }],
    walls: [{ x: 5, y: 1, orientation: "vertical" }],
  }, []);

  assertEquals(result, {
    holes: [],
    portals: [],
    pieces: [{ x: 4, y: 1, type: "puck" }],
    walls: [{ x: 5, y: 1, orientation: "vertical" }],
  });
});

Deno.test("resolveMoves() should return updated board state when passed a single move", () => {
  const result = resolveMoves({
    holes: [],
    portals: [],
    pieces: [{ x: 4, y: 1, type: "puck" }],
    walls: [{ x: 5, y: 1, orientation: "vertical" }],
  }, [[{ x: 4, y: 1 }, { x: 4, y: 7 }]]);

  assertEquals(result, {
    holes: [],
    portals: [],
    pieces: [{ x: 4, y: 7, type: "puck" }],
    walls: [{ x: 5, y: 1, orientation: "vertical" }],
  });
});

Deno.test("resolveMoves() should throw if passed an illegal move (a)", () => {
  assertThrows(() =>
    resolveMoves({
      holes: [],
      portals: [],
      pieces: [{ x: 4, y: 1, type: "puck" }],
      walls: [{ x: 4, y: 4, orientation: "horizontal" }],
    }, [[{ x: 4, y: 1 }, { x: 4, y: 7 }]])
  );
});

Deno.test("resolveMoves() should throw if passed an illegal move (b)", () => {
  assertThrows(() =>
    resolveMoves({
      holes: [],
      portals: [],
      pieces: [{ x: 4, y: 1, type: "puck" }],
      walls: [],
    }, [
      [{ x: 4, y: 1 }, { x: 4, y: 7 }],
      [{ x: 4, y: 1 }, { x: 5, y: 5 }],
    ])
  );
});

Deno.test("resolveMoves() should return updated board state when passed a list of moves", () => {
  const result = resolveMoves({
    holes: [],
    portals: [],
    pieces: [
      { x: 4, y: 1, type: "puck" },
      { x: 6, y: 6, type: "blocker" },
    ],
    walls: [{ x: 5, y: 4, orientation: "horizontal" }],
  }, [
    [{ x: 6, y: 6 }, { x: 6, y: 0 }],
    [{ x: 4, y: 1 }, { x: 4, y: 0 }],
    [{ x: 4, y: 0 }, { x: 5, y: 0 }],
    [{ x: 5, y: 0 }, { x: 5, y: 3 }],
  ]);

  assertEquals(result, {
    holes: [],
    portals: [],
    pieces: [
      { x: 5, y: 3, type: "puck" },
      { x: 6, y: 0, type: "blocker" },
    ],
    walls: [{ x: 5, y: 4, orientation: "horizontal" }],
  });
});

Deno.test("isValidSolution() should return false for non matching position", () => {
  const result = isValidSolution(
    {
      destination: { x: 0, y: 2 },
      pieces: [{ x: 4, y: 1, type: "puck" }],
    },
  );

  assertEquals(result, false);
});

Deno.test("isValidSolution() should return false for blocker", () => {
  const result = isValidSolution(
    {
      destination: { x: 0, y: 2 },
      pieces: [{ type: "blocker", x: 0, y: 2 }],
    },
  );

  assertEquals(result, false);
});

Deno.test("isValidSolution() should return true for winning position", () => {
  const result = isValidSolution(
    {
      destination: { x: 0, y: 2 },
      pieces: [{ type: "puck", x: 0, y: 2 }],
    },
  );

  assertEquals(result, true);
});

Deno.test("rotateBoard() right should rotate positions 90° clockwise", () => {
  const result = rotateBoard({
    holes: [],
    portals: [],
    destination: { x: 1, y: 2 },
    pieces: [
      { x: 3, y: 5, type: "puck" },
      { x: 6, y: 1, type: "blocker" },
    ],
    walls: [],
  }, "right");

  assertEquals(result.destination, { x: 5, y: 1 });
  assertEquals(result.pieces, [
    { x: 2, y: 3, type: "puck" },
    { x: 6, y: 6, type: "blocker" },
  ]);
});

Deno.test("rotateBoard() right should swap wall orientations", () => {
  const result = rotateBoard({
    holes: [],
    portals: [],
    destination: { x: 0, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [
      { x: 3, y: 4, orientation: "horizontal" },
      { x: 5, y: 2, orientation: "vertical" },
    ],
  }, "right");

  assertEquals(result.walls, [
    { x: 4, y: 3, orientation: "vertical" },
    { x: 5, y: 5, orientation: "horizontal" },
  ]);
});

Deno.test("rotateBoard() right applied 4 times returns the original board", () => {
  const board = {
    holes: [],
    portals: [],
    destination: { x: 2, y: 5 },
    pieces: [
      { x: 3, y: 1, type: "puck" as const },
      { x: 6, y: 4, type: "blocker" as const },
    ],
    walls: [
      { x: 4, y: 3, orientation: "horizontal" as const },
      { x: 5, y: 2, orientation: "vertical" as const },
    ],
  };

  const result = rotateBoard(
    rotateBoard(rotateBoard(rotateBoard(board, "right"), "right"), "right"),
    "right",
  );

  assertEquals(result, board);
});

Deno.test("rotateBoard() left should be the reverse of cw", () => {
  const board = {
    holes: [],
    portals: [],
    destination: { x: 2, y: 5 },
    pieces: [
      { x: 3, y: 1, type: "puck" as const },
      { x: 6, y: 4, type: "blocker" as const },
    ],
    walls: [
      { x: 4, y: 3, orientation: "horizontal" as const },
      { x: 5, y: 2, orientation: "vertical" as const },
    ],
  };

  const rotated = rotateBoard(board, "right");
  const result = rotateBoard(rotated, "left");

  assertEquals(result, board);
});

// --- flipBoard ---

Deno.test("flipBoard() horizontal should mirror positions left/right", () => {
  const result = flipBoard({
    holes: [],
    portals: [],
    destination: { x: 1, y: 3 },
    pieces: [
      { x: 2, y: 5, type: "puck" },
      { x: 6, y: 1, type: "blocker" },
    ],
    walls: [],
  }, "horizontal");

  assertEquals(result.destination, { x: 6, y: 3 });
  assertEquals(result.pieces, [
    { x: 5, y: 5, type: "puck" },
    { x: 1, y: 1, type: "blocker" },
  ]);
});

Deno.test("flipBoard() horizontal should keep wall orientations and shift positions", () => {
  const result = flipBoard({
    holes: [],
    portals: [],
    destination: { x: 0, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [
      { x: 3, y: 4, orientation: "horizontal" },
      { x: 5, y: 2, orientation: "vertical" },
    ],
  }, "horizontal");

  assertEquals(result.walls, [
    { x: 4, y: 4, orientation: "horizontal" },
    { x: 3, y: 2, orientation: "vertical" },
  ]);
});

Deno.test("flipBoard() horizontal applied twice returns the original board", () => {
  const board = {
    holes: [],
    portals: [],
    destination: { x: 2, y: 5 },
    pieces: [
      { x: 3, y: 1, type: "puck" as const },
      { x: 6, y: 4, type: "blocker" as const },
    ],
    walls: [
      { x: 4, y: 3, orientation: "horizontal" as const },
      { x: 5, y: 2, orientation: "vertical" as const },
    ],
  };

  const result = flipBoard(flipBoard(board, "horizontal"), "horizontal");

  assertEquals(result, board);
});

Deno.test("flipBoard() vertical should mirror positions up/down", () => {
  const result = flipBoard({
    holes: [],
    portals: [],
    destination: { x: 1, y: 2 },
    pieces: [
      { x: 3, y: 5, type: "puck" },
      { x: 6, y: 1, type: "blocker" },
    ],
    walls: [],
  }, "vertical");

  assertEquals(result.destination, { x: 1, y: 5 });
  assertEquals(result.pieces, [
    { x: 3, y: 2, type: "puck" },
    { x: 6, y: 6, type: "blocker" },
  ]);
});

Deno.test("flipBoard() vertical should keep wall orientations and shift positions", () => {
  const result = flipBoard({
    holes: [],
    portals: [],
    destination: { x: 0, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [
      { x: 3, y: 4, orientation: "horizontal" },
      { x: 5, y: 2, orientation: "vertical" },
    ],
  }, "vertical");

  assertEquals(result.walls, [
    { x: 3, y: 4, orientation: "horizontal" },
    { x: 5, y: 5, orientation: "vertical" },
  ]);
});

Deno.test("flipBoard() vertical applied twice returns the original board", () => {
  const board = {
    holes: [],
    portals: [],
    destination: { x: 2, y: 5 },
    pieces: [
      { x: 3, y: 1, type: "puck" as const },
      { x: 6, y: 4, type: "blocker" as const },
    ],
    walls: [
      { x: 4, y: 3, orientation: "horizontal" as const },
      { x: 5, y: 2, orientation: "vertical" as const },
    ],
  };

  const result = flipBoard(flipBoard(board, "vertical"), "vertical");

  assertEquals(result, board);
});

// --- holes ---

Deno.test("getSlide() should let a hole swallow a piece sliding into it", () => {
  const slide = getSlide({ x: 0, y: 0 }, "right", {
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
    holes: [{ x: 3, y: 0 }],
    portals: [],
  });

  assertEquals(slide?.outcome, "dropped");
  assertEquals(slide?.target, { x: 3, y: 0 });
});

Deno.test("getSlide() should stop at a wall standing before a hole", () => {
  const slide = getSlide({ x: 0, y: 0 }, "right", {
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [{ x: 2, y: 0, orientation: "vertical" }],
    holes: [{ x: 3, y: 0 }],
    portals: [],
  });

  assertEquals(slide?.outcome, "stopped");
  assertEquals(slide?.target, { x: 1, y: 0 });
});

Deno.test("resolveMoves() should remove a piece that fell in a hole", () => {
  const result = resolveMoves({
    pieces: [{ x: 0, y: 0, type: "puck" }, { x: 0, y: 5, type: "blocker" }],
    walls: [],
    holes: [{ x: 3, y: 0 }],
    portals: [],
  }, [[{ x: 0, y: 0 }, { x: 3, y: 0 }]]);

  assertEquals(result.pieces, [{ x: 0, y: 5, type: "blocker" }]);
});

// --- portals ---

Deno.test("getSlide() should carry momentum out of the paired portal", () => {
  const slide = getSlide({ x: 0, y: 0 }, "right", {
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
    holes: [],
    portals: [{ x: 2, y: 0 }, { x: 5, y: 4 }],
  });

  assertEquals(slide?.outcome, "stopped");
  assertEquals(slide?.target, { x: 7, y: 4 });
  // One leg up to the entry portal, one on from the exit.
  assertEquals(slide?.segments, [
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    [{ x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }],
  ]);
});

Deno.test("getSlide() should stop on the exit portal when the way beyond is blocked", () => {
  const slide = getSlide({ x: 0, y: 0 }, "right", {
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
    holes: [],
    portals: [{ x: 2, y: 0 }, { x: 7, y: 4 }],
  });

  assertEquals(slide?.outcome, "stopped");
  assertEquals(slide?.target, { x: 7, y: 4 });
});

Deno.test("getSlide() should stop on the entry portal when the exit is occupied", () => {
  // A piece can only sit on a portal mid-game — none may start on one.
  const slide = getSlide({ x: 0, y: 0 }, "right", {
    pieces: [{ x: 0, y: 0, type: "puck" }, { x: 5, y: 4, type: "blocker" }],
    walls: [],
    holes: [],
    portals: [{ x: 2, y: 0 }, { x: 5, y: 4 }],
  });

  assertEquals(slide?.outcome, "stopped");
  assertEquals(slide?.target, { x: 2, y: 0 });
});

Deno.test("getSlide() should slide over a portal that has no pair", () => {
  const slide = getSlide({ x: 0, y: 0 }, "right", {
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
    holes: [],
    portals: [{ x: 3, y: 0 }],
  });

  assertEquals(slide?.outcome, "stopped");
  assertEquals(slide?.target, { x: 7, y: 0 });
});

Deno.test("getSlide() should loop when the slide re-enters the portal it came in by", () => {
  const slide = getSlide({ x: 3, y: 0 }, "right", {
    pieces: [{ x: 3, y: 0, type: "puck" }],
    walls: [],
    holes: [],
    portals: [{ x: 5, y: 0 }, { x: 1, y: 0 }],
  });

  assertEquals(slide?.outcome, "looped");
  assertEquals(slide?.target, { x: 5, y: 0 });
});

Deno.test("resolveMoves() should keep a looping piece on the portal it entered", () => {
  const board = {
    pieces: [{ x: 3, y: 0, type: "puck" as const }],
    walls: [],
    holes: [],
    portals: [{ x: 5, y: 0 }, { x: 1, y: 0 }],
  };

  const result = resolveMoves(board, [[{ x: 3, y: 0 }, { x: 5, y: 0 }]]);

  assertEquals(result.pieces, [{ x: 5, y: 0, type: "puck" }]);
});

Deno.test("isLooped() should report a board locked by the last move", () => {
  const board = {
    pieces: [{ x: 3, y: 0, type: "puck" as const }],
    walls: [],
    holes: [],
    portals: [{ x: 5, y: 0 }, { x: 1, y: 0 }],
  };

  assertEquals(isLooped(board, [[{ x: 3, y: 0 }, { x: 5, y: 0 }]]), true);
});

Deno.test("isLooped() should be false once the looping move is undone", () => {
  const board = {
    pieces: [{ x: 3, y: 0, type: "puck" as const }],
    walls: [],
    holes: [],
    portals: [{ x: 5, y: 0 }, { x: 1, y: 0 }],
  };

  assertEquals(isLooped(board, []), false);
});

Deno.test("isLooped() should be false for an ordinary move", () => {
  const board = {
    pieces: [{ x: 0, y: 0, type: "puck" as const }],
    walls: [],
    holes: [],
    portals: [],
  };

  assertEquals(isLooped(board, [[{ x: 0, y: 0 }, { x: 7, y: 0 }]]), false);
});

// --- hazard validation ---

Deno.test("validateBoard() should throw when a piece starts on a hole", () => {
  assertThrows(
    () =>
      validateBoard({
        destination: { x: 5, y: 5 },
        pieces: [{ x: 2, y: 2, type: "puck" }],
        walls: [],
        holes: [{ x: 2, y: 2 }],
        portals: [],
      }),
    BoardError,
    "Piece starts on a hole or portal at (2, 2)",
  );
});

Deno.test("validateBoard() should throw when the destination is on a portal", () => {
  assertThrows(
    () =>
      validateBoard({
        destination: { x: 4, y: 4 },
        pieces: [{ x: 2, y: 2, type: "puck" }],
        walls: [],
        holes: [],
        portals: [{ x: 4, y: 4 }, { x: 6, y: 6 }],
      }),
    BoardError,
    "Destination is on a hole or portal at (4, 4)",
  );
});

Deno.test("validateBoard() should throw for a third portal", () => {
  assertThrows(
    () =>
      validateBoard({
        destination: { x: 5, y: 5 },
        pieces: [{ x: 2, y: 2, type: "puck" }],
        walls: [],
        holes: [],
        portals: [{ x: 1, y: 1 }, { x: 3, y: 3 }, { x: 4, y: 4 }],
      }),
    BoardError,
    "Board has more than two portals",
  );
});

Deno.test("validateBoard() should throw when a hole and a portal share a cell", () => {
  assertThrows(
    () =>
      validateBoard({
        destination: { x: 5, y: 5 },
        pieces: [{ x: 2, y: 2, type: "puck" }],
        walls: [],
        holes: [{ x: 3, y: 3 }],
        portals: [{ x: 3, y: 3 }, { x: 6, y: 6 }],
      }),
    BoardError,
    "Hole and portal share (3, 3)",
  );
});

Deno.test("validateBoard() should accept a single portal, which the editor holds mid-build", () => {
  const board = validateBoard({
    destination: { x: 5, y: 5 },
    pieces: [{ x: 2, y: 2, type: "puck" }],
    walls: [],
    holes: [],
    portals: [{ x: 3, y: 3 }],
  });

  assertEquals(board.portals, [{ x: 3, y: 3 }]);
});

// --- transforms carry hazards ---

Deno.test("rotateBoard() right should carry holes and portals", () => {
  const board = {
    destination: { x: 0, y: 0 },
    pieces: [{ x: 1, y: 1, type: "puck" as const }],
    walls: [],
    holes: [{ x: 2, y: 3 }],
    portals: [{ x: 4, y: 5 }, { x: 6, y: 7 }],
  };

  const result = rotateBoard(
    rotateBoard(rotateBoard(rotateBoard(board, "right"), "right"), "right"),
    "right",
  );

  assertEquals(result, board);
});

Deno.test("flipBoard() horizontal should mirror holes and portals", () => {
  const result = flipBoard({
    destination: { x: 0, y: 0 },
    pieces: [{ x: 1, y: 1, type: "puck" }],
    walls: [],
    holes: [{ x: 2, y: 3 }],
    portals: [{ x: 4, y: 5 }, { x: 6, y: 7 }],
  }, "horizontal");

  assertEquals(result.holes, [{ x: 5, y: 3 }]);
  assertEquals(result.portals, [{ x: 3, y: 5 }, { x: 1, y: 7 }]);
});

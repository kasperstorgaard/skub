import { assertEquals, assertThrows } from "@std/assert";

import {
  categorizeTile,
  composeBoard,
  countLanes,
  extractQuadrant,
  flipTile,
  formatTile,
  nextTileId,
  parseTile,
  pickTiles,
  placeTile,
  replaceQuadrant,
  rotateTile,
  TileError,
  toPlacements,
  validatePattern,
  validateTile,
} from "./tiles.ts";
import type { Tile, TileEntry } from "#/game/types.ts";

// The tile from the sketchbook's own notation: a blocker at B2, a vertical wall
// right of B3, and a horizontal wall below C3.
const TILE_MARKDOWN = `---
id: a-01
category: A
---

\`\`\`
+ A B C D +
1         |
2   #     |
3    |_   |
4         |
+---------+
\`\`\`
`;

const TILE: Tile = {
  destination: undefined,
  pieces: [{ x: 1, y: 1, type: "blocker" }],
  walls: [
    { x: 2, y: 2, orientation: "vertical" },
    { x: 2, y: 3, orientation: "horizontal" },
  ],
  holes: [],
  portals: [],
};

const EMPTY_TILE: Tile = {
  destination: undefined,
  pieces: [],
  walls: [],
  holes: [],
  portals: [],
};

Deno.test("parseTile() should read the grid, deriving the category", () => {
  const result = parseTile(TILE_MARKDOWN);

  assertEquals(result, {
    id: "a-01",
    name: undefined,
    category: "A",
    tile: TILE,
  });
});

Deno.test("formatTile() should render a tile back to its notation", () => {
  const result = formatTile({ id: "a-01", category: "A", tile: TILE });

  assertEquals(result, TILE_MARKDOWN);
});

Deno.test("parseTile() should throw when the filed category contradicts the contents", () => {
  assertThrows(
    () => parseTile(TILE_MARKDOWN.replace("category: A", "category: X")),
    TileError,
    "filed as X but reads as A",
  );
});

Deno.test("validateTile() should throw for a wall along the tile's own edge", () => {
  assertThrows(
    () =>
      validateTile({
        ...EMPTY_TILE,
        walls: [{ x: 0, y: 2, orientation: "vertical" }],
      }),
    Error,
    "duplicates board edge",
  );
});

Deno.test("validateTile() should throw for a wall past the tile's far edge", () => {
  assertThrows(
    () =>
      validateTile({
        ...EMPTY_TILE,
        walls: [{ x: 4, y: 2, orientation: "vertical" }],
      }),
    Error,
    "out of bounds",
  );
});

Deno.test("validateTile() should throw for a fourth blocker", () => {
  assertThrows(
    () =>
      validateTile({
        ...EMPTY_TILE,
        pieces: [
          { x: 0, y: 0, type: "blocker" },
          { x: 1, y: 1, type: "blocker" },
          { x: 2, y: 2, type: "blocker" },
          { x: 3, y: 3, type: "blocker" },
        ],
      }),
    TileError,
    "at most 3 allowed",
  );
});

Deno.test("validateTile() should throw for a second portal", () => {
  assertThrows(
    () =>
      validateTile({
        ...EMPTY_TILE,
        portals: [{ x: 0, y: 0 }, { x: 3, y: 3 }],
      }),
    TileError,
    "more than one portal",
  );
});

Deno.test("validateTile() should throw for a puck, which belongs to the board", () => {
  assertThrows(
    () =>
      validateTile({ ...EMPTY_TILE, pieces: [{ x: 0, y: 0, type: "puck" }] }),
    TileError,
    "Tile has a puck",
  );
});

Deno.test("countLanes() should count every row and column of an empty tile", () => {
  const result = countLanes(EMPTY_TILE);

  assertEquals(result, 8);
});

Deno.test("countLanes() should score a run held up only by a blocker as a half", () => {
  const result = countLanes({
    ...EMPTY_TILE,
    pieces: [{ x: 1, y: 1, type: "blocker" }],
  });

  assertEquals(result, 7);
});

Deno.test("countLanes() should score a walled run as closed", () => {
  const result = countLanes({
    ...EMPTY_TILE,
    walls: [{ x: 2, y: 1, orientation: "vertical" }],
  });

  assertEquals(result, 7);
});

Deno.test("countLanes() should score the sketchbook tile by both its walls and its blocker", () => {
  const result = countLanes(TILE);

  assertEquals(result, 5);
});

Deno.test("categorizeTile() should file a portal tile carrying holes as Z", () => {
  const result = categorizeTile({
    ...EMPTY_TILE,
    holes: [{ x: 0, y: 0 }],
    portals: [{ x: 3, y: 3 }],
  });

  assertEquals(result, "Z");
});

Deno.test("categorizeTile() should file a portal tile as P", () => {
  const result = categorizeTile({ ...EMPTY_TILE, portals: [{ x: 3, y: 3 }] });

  assertEquals(result, "P");
});

Deno.test("categorizeTile() should file a hole tile as X", () => {
  const result = categorizeTile({ ...EMPTY_TILE, holes: [{ x: 3, y: 3 }] });

  assertEquals(result, "X");
});

Deno.test("categorizeTile() should file a cluttered tile as B", () => {
  const result = categorizeTile({
    ...EMPTY_TILE,
    pieces: [
      { x: 1, y: 1, type: "blocker" },
      { x: 2, y: 2, type: "blocker" },
    ],
    walls: [
      { x: 1, y: 0, orientation: "vertical" },
      { x: 2, y: 1, orientation: "horizontal" },
      { x: 3, y: 3, orientation: "vertical" },
      { x: 1, y: 2, orientation: "horizontal" },
    ],
  });

  assertEquals(result, "B");
});

Deno.test("nextTileId() should take the next free number in its own category", () => {
  const result = nextTileId("B", ["b-07", "b-06", "a-09", "z-01"]);

  assertEquals(result, "b-08");
});

Deno.test("rotateTile() should turn walls a quarter-turn, swapping orientation", () => {
  const result = rotateTile({
    ...EMPTY_TILE,
    pieces: [{ x: 1, y: 1, type: "blocker" }],
    walls: [{ x: 1, y: 0, orientation: "vertical" }],
  }, 1);

  assertEquals(result, {
    destination: undefined,
    pieces: [{ x: 2, y: 1, type: "blocker" }],
    walls: [{ x: 3, y: 1, orientation: "horizontal" }],
    holes: [],
    portals: [],
  });
});

Deno.test("rotateTile() should return the tile it started from after four turns", () => {
  const result = rotateTile(rotateTile(TILE, 2), 2);

  assertEquals(result, TILE);
});

Deno.test("flipTile() should return the tile it started from after two flips", () => {
  const result = flipTile(flipTile(TILE));

  assertEquals(result, TILE);
});

Deno.test("placeTile() should shift a tile into its quadrant", () => {
  const result = placeTile(TILE, { x: 4, y: 4 });

  assertEquals(result, {
    destination: undefined,
    pieces: [{ x: 5, y: 5, type: "blocker" }],
    walls: [
      { x: 6, y: 6, orientation: "vertical" },
      { x: 6, y: 7, orientation: "horizontal" },
    ],
    holes: [],
    portals: [],
  });
});

Deno.test("extractQuadrant() should lift a placed tile back out unchanged", () => {
  const result = extractQuadrant(
    placeTile(TILE, { x: 4, y: 0 }),
    { x: 4, y: 0 },
  );

  assertEquals(result, TILE);
});

Deno.test("composeBoard() should lay four tiles into their quadrants", () => {
  const result = composeBoard([
    { ...EMPTY_TILE, pieces: [{ x: 1, y: 1, type: "blocker" }] },
    { ...EMPTY_TILE, walls: [{ x: 2, y: 1, orientation: "vertical" }] },
    { ...EMPTY_TILE, holes: [{ x: 3, y: 3 }] },
    { ...EMPTY_TILE, portals: [{ x: 2, y: 2 }] },
  ]);

  assertEquals(result, {
    destination: undefined,
    pieces: [{ x: 1, y: 1, type: "blocker" }],
    walls: [{ x: 6, y: 1, orientation: "vertical" }],
    holes: [{ x: 3, y: 7 }],
    portals: [{ x: 6, y: 6 }],
  });
});

Deno.test("composeBoard() should leave the seams between tiles wall-free", () => {
  const composed = composeBoard([TILE, TILE, TILE, TILE]);
  const result = composed.walls.filter((wall) =>
    (wall.orientation === "vertical" && wall.x === 4) ||
    (wall.orientation === "horizontal" && wall.y === 4)
  );

  assertEquals(result, []);
});

Deno.test("replaceQuadrant() should swap one quadrant and leave the puck standing", () => {
  const board = {
    ...composeBoard([EMPTY_TILE, EMPTY_TILE, EMPTY_TILE, EMPTY_TILE]),
    destination: { x: 7, y: 7 },
    pieces: [{ x: 1, y: 1, type: "puck" as const }],
  };

  const result = replaceQuadrant(board, TILE, { x: 0, y: 0 });

  assertEquals(result, {
    destination: { x: 7, y: 7 },
    pieces: [{ x: 1, y: 1, type: "puck" }, { x: 1, y: 1, type: "blocker" }],
    walls: [
      { x: 2, y: 2, orientation: "vertical" },
      { x: 2, y: 3, orientation: "horizontal" },
    ],
    holes: [],
    portals: [],
  });
});

Deno.test("validatePattern() should throw when a lone portal tile would leave the board unpaired", () => {
  assertThrows(
    () => validatePattern(["A", "A", "A", "P"]),
    TileError,
    "this pattern has 1",
  );
});

Deno.test("pickTiles() should deal the pattern, avoiding a repeat while it can", () => {
  const catalog: TileEntry[] = [
    { id: "a-01", category: "A", tile: EMPTY_TILE },
    { id: "a-02", category: "A", tile: EMPTY_TILE },
    { id: "p-01", category: "P", tile: EMPTY_TILE },
    { id: "p-02", category: "P", tile: EMPTY_TILE },
  ];

  // One draw per tile first, then two per slot: how far turned, and mirrored.
  const rolls = [0, 0, 0.9, 0.5, 0.5, 0.1, 0.6, 0, 0.9, 0, 0.25, 0.9];
  let roll = 0;

  const result = toPlacements(
    pickTiles(catalog, { mode: "pattern", pattern: ["A", "A", "P", "P"] }, {
      random: () => rolls[roll++],
    }),
  );

  assertEquals(result, [
    { id: "a-01", rotation: 2, flipped: true },
    { id: "a-02", rotation: 2, flipped: true },
    { id: "p-02", rotation: 3, flipped: true },
    { id: "p-01", rotation: 1 },
  ]);
});

Deno.test("pickTiles() should reuse one tile per category when asked for two distinct", () => {
  const catalog: TileEntry[] = [
    { id: "a-01", category: "A", tile: EMPTY_TILE },
    { id: "a-02", category: "A", tile: EMPTY_TILE },
    { id: "p-01", category: "P", tile: EMPTY_TILE },
    { id: "p-02", category: "P", tile: EMPTY_TILE },
  ];

  const result = toPlacements(
    pickTiles(
      catalog,
      { mode: "pattern", pattern: ["A", "A", "P", "P"], distinct: 2 },
      { random: () => 0 },
    ),
  );

  assertEquals(result, [
    { id: "a-01", rotation: 0, flipped: true },
    { id: "a-01", rotation: 0, flipped: true },
    { id: "p-01", rotation: 0, flipped: true },
    { id: "p-01", rotation: 0, flipped: true },
  ]);
});

Deno.test("pickTiles() should still deal every category a pattern names, however few distinct tiles are asked for", () => {
  const catalog: TileEntry[] = [
    { id: "a-01", category: "A", tile: EMPTY_TILE },
    { id: "b-01", category: "B", tile: EMPTY_TILE },
    { id: "p-01", category: "P", tile: EMPTY_TILE },
    { id: "z-01", category: "Z", tile: EMPTY_TILE },
  ];

  const result = toPlacements(
    pickTiles(
      catalog,
      { mode: "pattern", pattern: ["A", "B", "P", "Z"], distinct: 1 },
      { random: () => 0 },
    ),
  );

  assertEquals(result, [
    { id: "a-01", rotation: 0, flipped: true },
    { id: "b-01", rotation: 0, flipped: true },
    { id: "p-01", rotation: 0, flipped: true },
    { id: "z-01", rotation: 0, flipped: true },
  ]);
});

Deno.test("pickTiles() should say which category the catalog is missing", () => {
  assertThrows(
    () =>
      pickTiles([{ id: "a-01", category: "A", tile: EMPTY_TILE }], {
        mode: "pattern",
        pattern: ["A", "A", "P", "P"],
      }),
    TileError,
    "No P tiles in the catalog yet",
  );
});

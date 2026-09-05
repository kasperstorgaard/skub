import { assertEquals, assertObjectMatch, assertThrows } from "@std/assert";

import { BoardError } from "./board.ts";
import { parsePuzzle, ParserError } from "./parser.ts";

Deno.test("parsePuzzle - parses metadata with extra fields", () => {
  const markdown = `---
name: Advanced Puzzle
slug: advanced-puzzle
minMoves: 7
createdAt: 2025-06-15T00:00:00.000Z
---

+ A B C D E F G H +
1 @               |
2                 |
3                 |
4                 |
5                 |
6                 |
7                 |
8       X         |
+-----------------+
`;

  const result = parsePuzzle(markdown);

  assertObjectMatch(result, {
    name: "Advanced Puzzle",
    slug: "advanced-puzzle",
    minMoves: 7,
    board: {},
    createdAt: new Date("2025-06-15T00:00:00.000Z"),
  });
});

Deno.test("parsePuzzle - throws on missing frontmatter", () => {
  const markdown = `
+ A B C D E F G H +
1 @               |
2                 |
3                 |
4                 |
5                 |
6                 |
7                 |
8       X         |
+-----------------+
`;

  assertThrows(() => parsePuzzle(markdown), TypeError);
});

Deno.test("parsePuzzle - throws on missing name in metadata", () => {
  const markdown = `---
slug: no-name
---

+ A B C D E F G H +
1 @               |
2                 |
3                 |
4                 |
5                 |
6                 |
7                 |
8       X         |
+-----------------+
`;

  assertThrows(
    () => parsePuzzle(markdown),
    ParserError,
    "must include 'name' field",
  );
});

Deno.test("parsePuzzle - throws on missing board grid", () => {
  const markdown = `---
name: No Grid
---

This puzzle has no grid.
`;

  assertThrows(
    () => parsePuzzle(markdown),
    ParserError,
  );
});

Deno.test("parsePuzzle - throws on wrong number of rows", () => {
  const markdown = `---
name: Wrong Rows
---

+ A B C D E F G H +
1 @               |
2                 |
8       X         |
+-----------------+
`;

  assertThrows(
    () => parsePuzzle(markdown),
    ParserError,
  );
});

Deno.test("parsePuzzle - throws on multiple destinations", () => {
  const markdown = `---
name: Multiple Destinations
---

+ A B C D E F G H +
1 @               |
2   X             |
3                 |
4                 |
5                 |
6                 |
7                 |
8       X         |
+-----------------+
`;

  assertThrows(() => parsePuzzle(markdown), ParserError);
});

Deno.test("parsePuzzle - throws on unknown cell character", () => {
  const markdown = `---
name: Unknown Character
---

+ A B C D E F G H +
1 @               |
2   Q             |
3                 |
4                 |
5                 |
6                 |
7                 |
8       X         |
+-----------------+
`;

  assertThrows(
    () => parsePuzzle(markdown),
    ParserError,
    "Unknown cell character 'Q'",
  );
});

Deno.test("parsePuzzle - parses simple puzzle", () => {
  const markdown = `---
number: 5
name: Simple Puzzle
slug: simple-puzzle
createdAt: 2026-01-01T00:00:00.000Z
difficulty: medium
minMoves: 7
---

+ A B C D E F G H +
1                 |
2   @             |
3                 |
4                 |
5         #       |
6                 |
7                 |
8       X         |
+-----------------+
`;

  const result = parsePuzzle(markdown);

  assertEquals(result, {
    number: 5,
    name: "Simple Puzzle",
    slug: "simple-puzzle",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    difficulty: "medium",
    minMoves: 7,
    board: {
      destination: { x: 3, y: 7 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 4, y: 4, type: "blocker" },
      ],
      walls: [],
    },
  });
});

Deno.test("parsePuzzle - real-world example 1", () => {
  const markdown = `---
name: Around the middle
slug: around-the-middle
createdAt: 2025-06-15T00:00:00.000Z
difficulty: medium
minMoves: 7
---

Navigate the puck around the middle

+ A B C D E F G H +
1  |         |    |
2 _   #         _ |
3     _ _ _ @̲     |
4    |       |  # |
5 #  |_ _ _ _|    |
6 _             _ |
7       #̂         |
8    |         |  |
+-----------------+
`;

  const result = parsePuzzle(markdown);

  assertObjectMatch(result, {
    name: "Around the middle",
    slug: "around-the-middle",
    difficulty: "medium",
    minMoves: 7,
  });

  assertEquals(result.board, {
    destination: { x: 3, y: 6 },
    pieces: [
      { x: 2, y: 1, type: "blocker" },
      { x: 5, y: 2, type: "puck" },
      { x: 7, y: 3, type: "blocker" },
      { x: 0, y: 4, type: "blocker" },
      { x: 3, y: 6, type: "blocker" },
    ],
    walls: [
      { x: 1, y: 0, orientation: "vertical" },
      { x: 6, y: 0, orientation: "vertical" },
      { x: 0, y: 2, orientation: "horizontal" },
      { x: 7, y: 2, orientation: "horizontal" },
      { x: 2, y: 3, orientation: "horizontal" },
      { x: 3, y: 3, orientation: "horizontal" },
      { x: 4, y: 3, orientation: "horizontal" },
      { x: 5, y: 3, orientation: "horizontal" },
      { x: 2, y: 3, orientation: "vertical" },
      { x: 6, y: 3, orientation: "vertical" },
      { x: 2, y: 4, orientation: "vertical" },
      { x: 2, y: 5, orientation: "horizontal" },
      { x: 3, y: 5, orientation: "horizontal" },
      { x: 4, y: 5, orientation: "horizontal" },
      { x: 6, y: 4, orientation: "vertical" },
      { x: 5, y: 5, orientation: "horizontal" },
      { x: 0, y: 6, orientation: "horizontal" },
      { x: 7, y: 6, orientation: "horizontal" },
      { x: 2, y: 7, orientation: "vertical" },
      { x: 7, y: 7, orientation: "vertical" },
    ],
  });
});

Deno.test("parsePuzzle - real-world example 2", () => {
  const markdown = `---
name: Boxy
slug: boxy
createdAt: 2026-01-01T00:00:00.000Z
difficulty: medium
---

+ A B C D E F G H +
1                 |
2   # _ _ _ _ @   |
3    |       |    |
4            |    |
5            |    |
6    |_ _ X̲ _|    |
7   #         #   |
8                 |
+-----------------+
`;

  const result = parsePuzzle(markdown);

  assertObjectMatch(result, {
    name: "Boxy",
    slug: "boxy",
  });

  assertEquals(result.board, {
    destination: { x: 4, y: 5 },
    pieces: [
      { x: 1, y: 1, type: "blocker" },
      { x: 6, y: 1, type: "puck" },
      { x: 1, y: 6, type: "blocker" },
      { x: 6, y: 6, type: "blocker" },
    ],
    walls: [
      { x: 2, y: 2, orientation: "horizontal" },
      { x: 3, y: 2, orientation: "horizontal" },
      { x: 4, y: 2, orientation: "horizontal" },
      { x: 5, y: 2, orientation: "horizontal" },
      { x: 2, y: 2, orientation: "vertical" },
      { x: 6, y: 2, orientation: "vertical" },
      { x: 6, y: 3, orientation: "vertical" },
      { x: 6, y: 4, orientation: "vertical" },
      { x: 2, y: 5, orientation: "vertical" },
      { x: 2, y: 6, orientation: "horizontal" },
      { x: 3, y: 6, orientation: "horizontal" },
      { x: 4, y: 6, orientation: "horizontal" },
      { x: 6, y: 5, orientation: "vertical" },
      { x: 5, y: 6, orientation: "horizontal" },
    ],
  });
});

Deno.test("parsePuzzle - real-world example 3", () => {
  const markdown = `---
name: Joe
slug: joe
createdAt: 2026-02-03T00:00:00.000Z
---

+ A B C D E F G H +
1         #̂       |
2     _ _ _ _ _   |
3            |    |
4            |    |
5    |    @  |    |
6    |_ _  ̲ _|    |
7                 |
8     #       #   |
+-----------------+
`;

  const result = parsePuzzle(markdown);

  assertObjectMatch(result, {
    name: "Joe",
    slug: "joe",
  });

  assertEquals(result.board, {
    destination: { x: 4, y: 0 },
    pieces: [
      { x: 4, y: 0, type: "blocker" },
      { x: 4, y: 4, type: "puck" },
      { x: 2, y: 7, type: "blocker" },
      { x: 6, y: 7, type: "blocker" },
    ],
    walls: [
      { x: 2, y: 2, orientation: "horizontal" },
      { x: 3, y: 2, orientation: "horizontal" },
      { x: 4, y: 2, orientation: "horizontal" },
      { x: 5, y: 2, orientation: "horizontal" },
      { x: 6, y: 2, orientation: "horizontal" },

      { x: 6, y: 2, orientation: "vertical" },
      { x: 6, y: 3, orientation: "vertical" },
      { x: 2, y: 4, orientation: "vertical" },
      { x: 6, y: 4, orientation: "vertical" },
      { x: 2, y: 5, orientation: "vertical" },
      { x: 2, y: 6, orientation: "horizontal" },
      { x: 3, y: 6, orientation: "horizontal" },
      { x: 4, y: 6, orientation: "horizontal" },
      { x: 6, y: 5, orientation: "vertical" },
      { x: 5, y: 6, orientation: "horizontal" },
    ],
  });
});

Deno.test("parsePuzzle - keeps an unfinished draft board", () => {
  const markdown = `---
name: Untitled
slug: untitled
---

+ A B C D E F G H +
1                 |
2   #             |
3                 |
4     _           |
5                 |
6                 |
7                 |
8                 |
+-----------------+
`;

  // A draft is saved on every edit, long before it has a puck.
  const result = parsePuzzle(markdown, { validate: false });

  assertEquals(result.board.pieces, [{ x: 1, y: 1, type: "blocker" }]);
  assertEquals(result.board.walls, [{ x: 2, y: 4, orientation: "horizontal" }]);
  assertEquals(result.board.destination, { x: 0, y: 0 });

  assertThrows(
    () => parsePuzzle(markdown),
    BoardError,
    "Board has no destination",
  );
});

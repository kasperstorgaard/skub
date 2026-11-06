import { assertEquals } from "@std/assert";

import type { Wall } from "#/game/types.ts";
import { getBendPath, getWallShapes } from "#/game/wall-runs.ts";

// A box around the 2×2 cells from C4 to D5
const box: Wall[] = [
  { x: 2, y: 3, orientation: "horizontal" },
  { x: 3, y: 3, orientation: "horizontal" },
  { x: 2, y: 5, orientation: "horizontal" },
  { x: 3, y: 5, orientation: "horizontal" },
  { x: 2, y: 3, orientation: "vertical" },
  { x: 2, y: 4, orientation: "vertical" },
  { x: 4, y: 3, orientation: "vertical" },
  { x: 4, y: 4, orientation: "vertical" },
];

Deno.test("getWallShapes() leaves both ends of a lone wall free", () => {
  assertEquals(getWallShapes([{ x: 3, y: 2, orientation: "vertical" }]), {
    runs: [
      { x: 3, y: 2, orientation: "vertical", span: 1, ends: ["free", "free"] },
    ],
    bends: [],
  });
});

Deno.test("getWallShapes() merges a straight line of walls into one run", () => {
  const walls: Wall[] = [
    { x: 2, y: 4, orientation: "horizontal" },
    { x: 0, y: 4, orientation: "horizontal" },
    { x: 1, y: 4, orientation: "horizontal" },
  ];

  assertEquals(getWallShapes(walls), {
    runs: [
      {
        x: 0,
        y: 4,
        orientation: "horizontal",
        span: 3,
        ends: ["free", "free"],
      },
    ],
    bends: [],
  });
});

Deno.test("getWallShapes() bends an L round its corner", () => {
  const walls: Wall[] = [
    { x: 1, y: 1, orientation: "vertical" },
    { x: 1, y: 2, orientation: "vertical" },
    { x: 1, y: 3, orientation: "horizontal" },
    { x: 2, y: 3, orientation: "horizontal" },
  ];

  assertEquals(getWallShapes(walls), {
    runs: [
      {
        x: 1,
        y: 3,
        orientation: "horizontal",
        span: 2,
        ends: ["bent", "free"],
      },
      { x: 1, y: 1, orientation: "vertical", span: 2, ends: ["free", "bent"] },
    ],
    bends: [{ x: 1, y: 3, horizontal: "right", vertical: "up" }],
  });
});

Deno.test("getWallShapes() bends every corner of a box", () => {
  assertEquals(getWallShapes(box), {
    runs: [
      {
        x: 2,
        y: 3,
        orientation: "horizontal",
        span: 2,
        ends: ["bent", "bent"],
      },
      {
        x: 2,
        y: 5,
        orientation: "horizontal",
        span: 2,
        ends: ["bent", "bent"],
      },
      { x: 2, y: 3, orientation: "vertical", span: 2, ends: ["bent", "bent"] },
      { x: 4, y: 3, orientation: "vertical", span: 2, ends: ["bent", "bent"] },
    ],
    bends: [
      { x: 2, y: 3, horizontal: "right", vertical: "down" },
      { x: 4, y: 3, horizontal: "left", vertical: "down" },
      { x: 2, y: 5, horizontal: "right", vertical: "up" },
      { x: 4, y: 5, horizontal: "left", vertical: "up" },
    ],
  });
});

Deno.test("getWallShapes() runs a cross straight through its middle", () => {
  const walls: Wall[] = [
    { x: 4, y: 3, orientation: "vertical" },
    { x: 4, y: 4, orientation: "vertical" },
    { x: 3, y: 4, orientation: "horizontal" },
    { x: 4, y: 4, orientation: "horizontal" },
  ];

  assertEquals(getWallShapes(walls), {
    runs: [
      {
        x: 3,
        y: 4,
        orientation: "horizontal",
        span: 2,
        ends: ["free", "free"],
      },
      { x: 4, y: 3, orientation: "vertical", span: 2, ends: ["free", "free"] },
    ],
    bends: [],
  });
});

Deno.test("getWallShapes() runs a 'd' stem down the box's side, joining the top in a T", () => {
  const walls: Wall[] = [
    ...box,
    { x: 4, y: 1, orientation: "vertical" },
    { x: 4, y: 2, orientation: "vertical" },
  ];

  assertEquals(getWallShapes(walls), {
    runs: [
      {
        x: 2,
        y: 3,
        orientation: "horizontal",
        span: 2,
        ends: ["bent", "joined"],
      },
      {
        x: 2,
        y: 5,
        orientation: "horizontal",
        span: 2,
        ends: ["bent", "bent"],
      },
      { x: 2, y: 3, orientation: "vertical", span: 2, ends: ["bent", "bent"] },
      { x: 4, y: 1, orientation: "vertical", span: 4, ends: ["free", "bent"] },
    ],
    bends: [
      { x: 2, y: 3, horizontal: "right", vertical: "down" },
      { x: 2, y: 5, horizontal: "right", vertical: "up" },
      { x: 4, y: 5, horizontal: "left", vertical: "up" },
    ],
  });
});

Deno.test("getWallShapes() keeps parallel walls on neighbouring lines apart", () => {
  const walls: Wall[] = [
    { x: 3, y: 2, orientation: "vertical" },
    { x: 4, y: 3, orientation: "vertical" },
  ];

  assertEquals(getWallShapes(walls), {
    runs: [
      { x: 3, y: 2, orientation: "vertical", span: 1, ends: ["free", "free"] },
      { x: 4, y: 3, orientation: "vertical", span: 1, ends: ["free", "free"] },
    ],
    bends: [],
  });
});

Deno.test("getBendPath() arcs a top-left corner from its downward wall to its rightward one", () => {
  assertEquals(
    getBendPath({ x: 2, y: 3, horizontal: "right", vertical: "down" }),
    "M0 2A2 2 0 0 1 2 0",
  );
});

Deno.test("getBendPath() arcs a bottom-right corner the other way round", () => {
  assertEquals(
    getBendPath({ x: 4, y: 5, horizontal: "left", vertical: "up" }),
    "M0 -2A2 2 0 0 1 -2 0",
  );
});

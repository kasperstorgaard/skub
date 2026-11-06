import { assertEquals } from "@std/assert";

import type { Wall } from "#/game/types.ts";
import { getWallPaths } from "#/game/wall-paths.ts";

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

Deno.test("getWallPaths() draws a lone wall on the line left of its cell", () => {
  assertEquals(getWallPaths([{ x: 3, y: 2, orientation: "vertical" }]), [
    "M3 2V3",
  ]);
});

Deno.test("getWallPaths() draws a straight run as one line", () => {
  const walls: Wall[] = [
    { x: 0, y: 4, orientation: "horizontal" },
    { x: 1, y: 4, orientation: "horizontal" },
    { x: 2, y: 4, orientation: "horizontal" },
  ];

  assertEquals(getWallPaths(walls), ["M0 4H3"]);
});

Deno.test("getWallPaths() joins an L at its corner", () => {
  const walls: Wall[] = [
    { x: 1, y: 1, orientation: "vertical" },
    { x: 1, y: 2, orientation: "vertical" },
    { x: 1, y: 3, orientation: "horizontal" },
    { x: 2, y: 3, orientation: "horizontal" },
  ];

  assertEquals(getWallPaths(walls), ["M1 1V3H3"]);
});

Deno.test("getWallPaths() closes a box", () => {
  assertEquals(getWallPaths(box), ["M2 3H4V5H2Z"]);
});

Deno.test("getWallPaths() runs a cross straight through its middle", () => {
  const walls: Wall[] = [
    { x: 4, y: 3, orientation: "vertical" },
    { x: 4, y: 4, orientation: "vertical" },
    { x: 3, y: 4, orientation: "horizontal" },
    { x: 4, y: 4, orientation: "horizontal" },
  ];

  assertEquals(getWallPaths(walls), ["M4 3V5", "M3 4H5"]);
});

Deno.test("getWallPaths() traces a box with a stem, a 'd', as one path", () => {
  const walls: Wall[] = [
    ...box,
    { x: 4, y: 1, orientation: "vertical" },
    { x: 4, y: 2, orientation: "vertical" },
  ];

  assertEquals(getWallPaths(walls), ["M4 1V5H2V3H4"]);
});

Deno.test("getWallPaths() keeps walls that don't touch apart", () => {
  const walls: Wall[] = [
    { x: 6, y: 6, orientation: "horizontal" },
    { x: 1, y: 1, orientation: "vertical" },
  ];

  assertEquals(getWallPaths(walls), ["M1 1V2", "M6 6H7"]);
});

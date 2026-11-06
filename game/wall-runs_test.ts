import { assertEquals } from "@std/assert";

import type { Wall } from "#/game/types.ts";
import { getWallRuns } from "#/game/wall-runs.ts";

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

Deno.test("getWallRuns() leaves both ends of a lone wall free", () => {
  assertEquals(getWallRuns([{ x: 3, y: 2, orientation: "vertical" }]), [
    { x: 3, y: 2, orientation: "vertical", span: 1, ends: ["free", "free"] },
  ]);
});

Deno.test("getWallRuns() merges a straight line of walls into one run", () => {
  const walls: Wall[] = [
    { x: 2, y: 4, orientation: "horizontal" },
    { x: 0, y: 4, orientation: "horizontal" },
    { x: 1, y: 4, orientation: "horizontal" },
  ];

  assertEquals(getWallRuns(walls), [
    { x: 0, y: 4, orientation: "horizontal", span: 3, ends: ["free", "free"] },
  ]);
});

Deno.test("getWallRuns() joins an L at its corner", () => {
  const walls: Wall[] = [
    { x: 1, y: 1, orientation: "vertical" },
    { x: 1, y: 2, orientation: "vertical" },
    { x: 1, y: 3, orientation: "horizontal" },
    { x: 2, y: 3, orientation: "horizontal" },
  ];

  assertEquals(getWallRuns(walls), [
    {
      x: 1,
      y: 3,
      orientation: "horizontal",
      span: 2,
      ends: ["joined", "free"],
    },
    { x: 1, y: 1, orientation: "vertical", span: 2, ends: ["free", "joined"] },
  ]);
});

Deno.test("getWallRuns() joins every corner of a box", () => {
  assertEquals(getWallRuns(box), [
    {
      x: 2,
      y: 3,
      orientation: "horizontal",
      span: 2,
      ends: ["joined", "joined"],
    },
    {
      x: 2,
      y: 5,
      orientation: "horizontal",
      span: 2,
      ends: ["joined", "joined"],
    },
    {
      x: 2,
      y: 3,
      orientation: "vertical",
      span: 2,
      ends: ["joined", "joined"],
    },
    {
      x: 4,
      y: 3,
      orientation: "vertical",
      span: 2,
      ends: ["joined", "joined"],
    },
  ]);
});

Deno.test("getWallRuns() runs a cross straight through its middle", () => {
  const walls: Wall[] = [
    { x: 4, y: 3, orientation: "vertical" },
    { x: 4, y: 4, orientation: "vertical" },
    { x: 3, y: 4, orientation: "horizontal" },
    { x: 4, y: 4, orientation: "horizontal" },
  ];

  assertEquals(getWallRuns(walls), [
    { x: 3, y: 4, orientation: "horizontal", span: 2, ends: ["free", "free"] },
    { x: 4, y: 3, orientation: "vertical", span: 2, ends: ["free", "free"] },
  ]);
});

Deno.test("getWallRuns() runs a 'd' stem down the box's side as one wall", () => {
  const walls: Wall[] = [
    ...box,
    { x: 4, y: 1, orientation: "vertical" },
    { x: 4, y: 2, orientation: "vertical" },
  ];

  assertEquals(getWallRuns(walls), [
    {
      x: 2,
      y: 3,
      orientation: "horizontal",
      span: 2,
      ends: ["joined", "joined"],
    },
    {
      x: 2,
      y: 5,
      orientation: "horizontal",
      span: 2,
      ends: ["joined", "joined"],
    },
    {
      x: 2,
      y: 3,
      orientation: "vertical",
      span: 2,
      ends: ["joined", "joined"],
    },
    { x: 4, y: 1, orientation: "vertical", span: 4, ends: ["free", "joined"] },
  ]);
});

Deno.test("getWallRuns() keeps parallel walls on neighbouring lines apart", () => {
  const walls: Wall[] = [
    { x: 3, y: 2, orientation: "vertical" },
    { x: 4, y: 3, orientation: "vertical" },
  ];

  assertEquals(getWallRuns(walls), [
    { x: 3, y: 2, orientation: "vertical", span: 1, ends: ["free", "free"] },
    { x: 4, y: 3, orientation: "vertical", span: 1, ends: ["free", "free"] },
  ]);
});

import { assertEquals } from "@std/assert/equals";

import { getGuides } from "./guides.ts";

Deno.test("getGuides() should return a guide for each available direction", () => {
  const result = getGuides(
    {
      holes: [],
      portals: [],
      pieces: [{ x: 3, y: 3, type: "puck" }],
      walls: [],
    },
    { active: { x: 3, y: 3 } },
  );

  assertEquals(result, [
    {
      move: [{ x: 3, y: 3 }, { x: 3, y: 0 }],
      to: { x: 3, y: 0 },
      isHint: false,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 7, y: 3 }],
      to: { x: 7, y: 3 },
      isHint: false,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 3, y: 7 }],
      to: { x: 3, y: 7 },
      isHint: false,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 0, y: 3 }],
      to: { x: 0, y: 3 },
      isHint: false,
    },
  ]);
});

Deno.test("getGuides() should respect walls and pieces", () => {
  const result = getGuides(
    {
      holes: [],
      portals: [],
      pieces: [
        { x: 3, y: 3, type: "puck" },
        { x: 3, y: 1, type: "blocker" },
      ],
      walls: [{ x: 5, y: 3, orientation: "vertical" }],
    },
    { active: { x: 3, y: 3 } },
  );

  assertEquals(result, [
    {
      move: [{ x: 3, y: 3 }, { x: 3, y: 2 }],
      to: { x: 3, y: 2 },
      isHint: false,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 4, y: 3 }],
      to: { x: 4, y: 3 },
      isHint: false,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 3, y: 7 }],
      to: { x: 3, y: 7 },
      isHint: false,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 0, y: 3 }],
      to: { x: 0, y: 3 },
      isHint: false,
    },
  ]);
});

Deno.test("getGuides() should return empty for position without a piece", () => {
  const result = getGuides(
    { holes: [], portals: [], pieces: [], walls: [] },
    { active: { x: 4, y: 4 } },
  );

  assertEquals(result, []);
});

Deno.test("getGuides() hint should replace matching direction in place", () => {
  const result = getGuides(
    {
      holes: [],
      portals: [],
      pieces: [{ x: 3, y: 3, type: "puck" }],
      walls: [],
    },
    { active: { x: 3, y: 3 }, hint: [{ x: 3, y: 3 }, { x: 3, y: 0 }] },
  );

  assertEquals(result, [
    {
      move: [{ x: 3, y: 3 }, { x: 3, y: 0 }],
      to: { x: 3, y: 0 },
      isHint: true,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 7, y: 3 }],
      to: { x: 7, y: 3 },
      isHint: false,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 3, y: 7 }],
      to: { x: 3, y: 7 },
      isHint: false,
    },
    {
      move: [{ x: 3, y: 3 }, { x: 0, y: 3 }],
      to: { x: 0, y: 3 },
      isHint: false,
    },
  ]);
});

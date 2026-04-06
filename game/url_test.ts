import { assertEquals, assertThrows } from "@std/assert";

import {
  decodeState,
  encodeState,
  getActiveHref,
  getDifficulty,
  getHintHref,
  getMovesHref,
  getPage,
  getRedoHref,
  getReplaySpeed,
  getResetHref,
  getUndoHref,
} from "#/game/url.ts";

Deno.test("encodeState() should add all params", () => {
  const result = encodeState({
    moves: [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
    active: { x: 5, y: 0 },
    cursor: 3,
  });

  assertEquals(result, "moves=A1A6&active=F1&cursor=3");
});

Deno.test("decodeState() should extract all params", () => {
  const result = decodeState("/puzzles/test?moves=F6F3&active=H8&cursor=0");

  assertEquals(result, {
    moves: [
      [{ x: 5, y: 5 }, { x: 5, y: 2 }],
    ],
    active: { x: 7, y: 7 },
    cursor: 0,
    hint: undefined,
  });
});

Deno.test("encodeState() should include hint param", () => {
  const result = encodeState({
    moves: [],
    hint: [{ x: 0, y: 0 }, { x: 7, y: 0 }],
  });

  assertEquals(result, "hint=A1H1");
});

Deno.test("decodeState() should extract hint param", () => {
  const result = decodeState("/puzzles/test?hint=A1H1");

  assertEquals(result, {
    moves: [],
    active: undefined,
    cursor: undefined,
    hint: [{ x: 0, y: 0 }, { x: 7, y: 0 }],
  });
});

Deno.test("getMovesHref() should append move and update cursor", () => {
  const result = getMovesHref(
    [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
    {
      href: "/puzzles/test",
      moves: [],
      cursor: 0,
    },
  );

  assertEquals(result, "/puzzles/test?moves=A1A6&active=A6&cursor=1");
});

Deno.test("getMovesHref() should truncate moves at cursor position", () => {
  const result = getMovesHref(
    [[{ x: 2, y: 2 }, { x: 2, y: 7 }]],
    {
      href: "/puzzles/test",
      moves: [
        [{ x: 0, y: 0 }, { x: 0, y: 5 }],
        [{ x: 0, y: 5 }, { x: 5, y: 5 }],
      ],
      cursor: 1,
    },
  );

  assertEquals(result, "/puzzles/test?moves=A1A6-C3C8&active=C8&cursor=2");
});

Deno.test("getActiveHref() should set active position", () => {
  const result = getActiveHref(
    { x: 3, y: 4 },
    {
      href: "/puzzles/test",
      moves: [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
      cursor: 1,
    },
  );

  assertEquals(result, "/puzzles/test?moves=A1A6&active=D5&cursor=1");
});

Deno.test("getUndoHref() should decrement cursor", () => {
  const result = getUndoHref("/puzzles/test", {
    moves: [
      [{ x: 0, y: 0 }, { x: 0, y: 5 }],
      [{ x: 0, y: 5 }, { x: 5, y: 5 }],
    ],
    cursor: 2,
  });

  assertEquals(result, "/puzzles/test?moves=A1A6-F6&cursor=1");
});

Deno.test("getUndoHref() should not go below zero", () => {
  const result = getUndoHref("/puzzles/test", {
    moves: [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
    cursor: 0,
  });

  assertEquals(result, "/puzzles/test?moves=A1A6&cursor=0");
});

Deno.test("getRedoHref() should increment cursor", () => {
  const result = getRedoHref("/puzzles/test", {
    moves: [
      [{ x: 0, y: 0 }, { x: 0, y: 5 }],
      [{ x: 0, y: 5 }, { x: 5, y: 5 }],
    ],
    cursor: 0,
  });

  assertEquals(result, "/puzzles/test?moves=A1A6-F6&cursor=1");
});

Deno.test("getRedoHref() should not exceed moves length", () => {
  const result = getRedoHref("/puzzles/test", {
    moves: [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
    cursor: 1,
  });

  assertEquals(result, "/puzzles/test?moves=A1A6&cursor=1");
});

Deno.test("getMovesHref() should not include hint", () => {
  const result = getMovesHref(
    [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
    {
      href: "/puzzles/test",
      moves: [],
      cursor: 0,
      hint: [{ x: 1, y: 1 }, { x: 1, y: 7 }],
    },
  );

  assertEquals(result.includes("hint"), false);
});

Deno.test("getActiveHref() should preserve hint", () => {
  const result = getActiveHref(
    { x: 3, y: 4 },
    {
      href: "/puzzles/test",
      moves: [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
      cursor: 1,
      hint: [{ x: 1, y: 1 }, { x: 1, y: 7 }],
    },
  );

  assertEquals(result.includes("hint=B2B8"), true);
});

Deno.test("getUndoHref() should not include hint", () => {
  const result = getUndoHref("/puzzles/test", {
    moves: [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
    cursor: 1,
    hint: [{ x: 1, y: 1 }, { x: 1, y: 7 }],
  });

  assertEquals(result.includes("hint"), false);
});

Deno.test("getRedoHref() should not include hint", () => {
  const result = getRedoHref("/puzzles/test", {
    moves: [[{ x: 0, y: 0 }, { x: 0, y: 5 }]],
    cursor: 0,
    hint: [{ x: 1, y: 1 }, { x: 1, y: 7 }],
  });

  assertEquals(result.includes("hint"), false);
});

Deno.test("getResetHref() should remove all game params including hint", () => {
  const result = getResetHref(
    "/puzzles/test?moves=A1A6&active=F1&cursor=1&hint=B2B8&other=kept",
  );

  assertEquals(result, "/puzzles/test?other=kept");
});

Deno.test("getResetHref() should preserve pathname", () => {
  const result = getResetHref("/puzzles/my-puzzle?moves=A1A6&cursor=1");

  assertEquals(result, "/puzzles/my-puzzle");
});

Deno.test("getResetHref() should return clean URL when only game params exist", () => {
  const result = getResetHref("/puzzles/test?moves=A1A6&active=F1&cursor=2");

  assertEquals(result, "/puzzles/test");
});

Deno.test("getHintHref() should rewrite pathname to hint route", () => {
  const result = getHintHref("/puzzles/my-puzzle?moves=A1A6&cursor=1");

  assertEquals(result, "/puzzles/my-puzzle/hint?moves=A1A6&cursor=1");
});

Deno.test("getHintHref() should throw when URL has no puzzle slug", () => {
  assertThrows(() => getHintHref("/other/path"));
});

Deno.test("getReplaySpeed() should return the replay_speed param", () => {
  assertEquals(getReplaySpeed("/puzzles/test?replay_speed=1.6"), 1.6);
});

Deno.test("getDifficulty() should return multiple values", () => {
  assertEquals(getDifficulty("/puzzles?difficulty=medium,hard"), [
    "medium",
    "hard",
  ]);
});

Deno.test("getDifficulty() should return null when empty", () => {
  assertEquals(getDifficulty("/puzzles?difficulty=not-easy"), null);
});

Deno.test("getPage() should return the page param", () => {
  assertEquals(getPage("/puzzles?page=7"), 7);
});

import { assertEquals } from "@std/assert";

import {
  classifyTransition,
  observe,
  readSolveTelemetry,
  resetSolveTelemetry,
  snapshot,
} from "#/client/solve-telemetry.ts";

const at = (moves: string, cursor: number) => ({ moves, cursor });
const url = (query = "") => `https://skub.dev/puzzles/boxy${query}`;

Deno.test("a fresh board with a first move reports one move", () => {
  resetSolveTelemetry();
  observe("boxy", url());
  observe("boxy", url("?moves=D2D8&cursor=1"), true);

  assertEquals(readSolveTelemetry("boxy")?.moves, 1);
  assertEquals(readSolveTelemetry("boxy")?.interactions, 1);
});

Deno.test("a board never moved on reports nothing", () => {
  resetSolveTelemetry();
  observe("boxy", url());

  assertEquals(readSolveTelemetry("boxy"), undefined);
});

Deno.test("a solve resumed from a url with moves reports nothing", () => {
  // The hint link is a full page navigation, so the module restarts mid-solve.
  resetSolveTelemetry();
  observe("boxy", url("?moves=D2D8-C4C3&cursor=2"));
  observe("boxy", url("?moves=D2D8-C4C3-G3&cursor=3"), true);

  assertEquals(readSolveTelemetry("boxy"), undefined);
});

Deno.test("observing the same url twice counts one interaction", () => {
  resetSolveTelemetry();
  observe("boxy", url());
  observe("boxy", url("?moves=D2D8&cursor=1"), true);
  observe("boxy", url("?moves=D2D8&cursor=1"));

  assertEquals(readSolveTelemetry("boxy")?.moves, 1);
});

Deno.test("interactions total every kind of action", () => {
  resetSolveTelemetry();
  observe("boxy", url());
  observe("boxy", url("?moves=D2D8&cursor=1"), true);
  observe("boxy", url("?moves=D2D8-C4C3&cursor=2"), true);
  observe("boxy", url("?moves=D2D8-C4C3&cursor=1"));
  observe("boxy", url("?moves=D2D8-C4C3&cursor=2"));
  observe("boxy", url());

  const telemetry = readSolveTelemetry("boxy");
  assertEquals(telemetry?.moves, 2);
  assertEquals(telemetry?.undos, 1);
  assertEquals(telemetry?.redos, 1);
  assertEquals(telemetry?.resets, 1);
  assertEquals(telemetry?.interactions, 5);
});

Deno.test("replaying a move after an undo counts as a move, not a redo", () => {
  resetSolveTelemetry();
  observe("boxy", url());
  observe("boxy", url("?moves=D2D8&cursor=1"), true);
  observe("boxy", url("?moves=D2D8&cursor=0"));
  observe("boxy", url("?moves=D2D8&cursor=1"), true);

  const telemetry = readSolveTelemetry("boxy");
  assertEquals(telemetry?.moves, 2);
  assertEquals(telemetry?.redos, 0);
  assertEquals(telemetry?.undos, 1);
});

Deno.test("a second puzzle does not inherit the first attempt's counts", () => {
  resetSolveTelemetry();
  observe("boxy", url());
  observe("boxy", url("?moves=D2D8&cursor=1"), true);
  observe("henrik", "https://skub.dev/puzzles/henrik");

  assertEquals(readSolveTelemetry("boxy"), undefined);
  assertEquals(readSolveTelemetry("henrik"), undefined);
});

Deno.test("the clock starts at the first move, not at page load", async () => {
  resetSolveTelemetry();
  observe("boxy", url());
  await new Promise((resolve) => setTimeout(resolve, 40));
  observe("boxy", url("?moves=D2D8&cursor=1"), true);

  const duration = readSolveTelemetry("boxy")?.durationMs ?? Infinity;
  assertEquals(duration < 40, true);
});

Deno.test("a move appended at the cursor is classified as a move", () => {
  assertEquals(classifyTransition(at("D2D8", 1), at("D2D8-C4C3", 2)), "move");
});

Deno.test("a move made after an undo truncates redo history", () => {
  assertEquals(
    classifyTransition(at("D2D8-C4C3-G3", 1), at("D2D8-B4F4", 2)),
    "move",
  );
});

Deno.test("advancing the cursor over unchanged moves is a redo", () => {
  const moves = "D2D8-C4C3";

  assertEquals(classifyTransition(at(moves, 1), at(moves, 2)), "redo");
});

Deno.test("retreating the cursor is an undo", () => {
  const moves = "D2D8-C4C3";

  assertEquals(classifyTransition(at(moves, 2), at(moves, 1)), "undo");
});

Deno.test("clearing the moves param is a reset", () => {
  assertEquals(classifyTransition(at("D2D8-C4C3", 2), at("", 0)), "reset");
});

Deno.test("an unchanged url is not an interaction", () => {
  const state = at("D2D8", 1);

  assertEquals(classifyTransition(state, state), null);
});

Deno.test("selecting a piece is not an interaction", () => {
  const prev = snapshot(url("?moves=D2D8&cursor=1"));
  const next = snapshot(url("?moves=D2D8&cursor=1&active=C4"));

  assertEquals(classifyTransition(prev, next), null);
});

Deno.test("a missing cursor means every move is applied", () => {
  assertEquals(snapshot(url("?moves=D2D8-C4C3")).cursor, 2);
});

Deno.test("a url with no game state decodes to an empty snapshot", () => {
  assertEquals(snapshot(url()), { moves: "", cursor: 0 });
});

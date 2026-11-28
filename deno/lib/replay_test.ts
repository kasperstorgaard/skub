import { assertEquals, assertStringIncludes } from "@std/assert";

import {
  buildPortalKeyframes,
  buildReplayKeyframes,
  warpDuration,
} from "./replay.ts";

Deno.test("buildReplayKeyframes() walks a single-leg slide from end to end", () => {
  const css = buildReplayKeyframes([{
    id: "p_0",
    legs: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]],
  }], 1);

  assertStringIncludes(css, "@keyframes replay-p_0 {");
  assertStringIncludes(css, "0% { --x: 0; --y: 0; }");
  assertStringIncludes(css, "100% { --x: 2; --y: 0; }");
});

Deno.test("buildReplayKeyframes() jumps between legs rather than gliding across", () => {
  // Two legs meaning a portal: the piece must not travel (2,0) → (5,4) directly.
  const css = buildReplayKeyframes([{
    id: "p_0",
    legs: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      [{ x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }],
    ],
  }], 1);

  // The entry and the exit sit at all but the same moment, so nothing is drawn
  // in between them.
  assertStringIncludes(css, "--x: 2; --y: 0;");
  assertStringIncludes(css, "--x: 5; --y: 4;");
  assertStringIncludes(css, "100% { --x: 7; --y: 4; }");
});

Deno.test("buildPortalKeyframes() takes the piece off the board between the legs", () => {
  const css = buildPortalKeyframes({
    id: "p_0",
    nonce: 3,
    legs: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      [{ x: 5, y: 4 }, { x: 6, y: 4 }],
    ],
  });

  assertStringIncludes(css, "@keyframes warp-p_0-3 {");
  assertStringIncludes(css, "@keyframes warp-p_0-3-squish {");
  assertStringIncludes(css, "100% { --x: 6; --y: 4; }");
  // Nothing is on the board for the whole pause between the two legs.
  assertStringIncludes(css, "25% { scale: 0 0.6; }");
  assertStringIncludes(css, "75% { scale: 0 0.6; }");
  // Narrows going in, flattens coming back out.
  assertStringIncludes(css, "scale: 0.8 1;");
  assertStringIncludes(css, "scale: 1 0.8;");
});

Deno.test("buildPortalKeyframes() travels each leg at an ordinary move's pace", () => {
  const warp = {
    id: "p_0",
    nonce: 1,
    legs: [[{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ x: 5, y: 4 }, { x: 6, y: 4 }]],
  };

  // Two legs at 200ms each, with the 400ms pause between them.
  assertEquals(warpDuration(warp), 800);

  // Each leg eases out on its own; the pause between keeps its full length,
  // which it would not if the whole animation were eased.
  assertEquals(
    buildPortalKeyframes(warp).match(/animation-timing-function: ease-out/g)
      ?.length,
    2,
  );
});

Deno.test("buildPortalKeyframes() gives each warp its own name so a repeat move restarts", () => {
  const legs = [[{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ x: 5, y: 4 }, {
    x: 6,
    y: 4,
  }]];

  const first = buildPortalKeyframes({ id: "p_0", nonce: 1, legs });
  const second = buildPortalKeyframes({ id: "p_0", nonce: 2, legs });

  assertEquals(first === second, false);
  assertStringIncludes(second, "warp-p_0-2");
});

Deno.test("buildReplayKeyframes() keeps a swallowed piece visible until it falls", () => {
  const css = buildReplayKeyframes([
    { id: "b_1", legs: [[{ x: 4, y: 7 }, { x: 4, y: 0 }]], dropped: true },
    { id: "p_0", legs: [[{ x: 0, y: 7 }, { x: 7, y: 7 }]] },
  ], 2);

  // It is on the board for its own move, then gone for the rest of the replay.
  assertStringIncludes(css, "@keyframes replay-b_1-drop {");
  assertStringIncludes(css, "0% { scale: 1 1; }");
  assertStringIncludes(css, "100% { scale: 0 0; }");

  // A piece that never falls gets no drop rule at all.
  assertEquals(css.includes("replay-p_0-drop"), false);
});

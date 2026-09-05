import { assertEquals, assertStringIncludes } from "@std/assert";

import { buildPortalKeyframes, buildReplayKeyframes } from "./replay.ts";

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

Deno.test("buildPortalKeyframes() holds the piece in the portal while it squishes", () => {
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
  assertStringIncludes(css, "0% { --x: 0; --y: 0; }");
  assertStringIncludes(css, "100% { --x: 6; --y: 4; }");
  // Narrows going in, flattens coming out.
  assertStringIncludes(css, "scale: 0.8 1;");
  assertStringIncludes(css, "scale: 1 0.8;");
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

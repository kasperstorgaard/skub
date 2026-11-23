import { assertEquals, assertThrows } from "@std/assert";

import { getBlastRadius } from "./blast-radius.ts";

Deno.test("getBlastRadius runs a changed route's tests and the flows", () => {
  const selected = getBlastRadius(["game/board.ts"], {
    "routes/puzzles/[slug]/index.tsx": [
      "routes/puzzles/[slug]/index.tsx",
      "game/board.ts",
    ],
    "routes/profile/index.tsx": ["routes/profile/index.tsx"],
    "routes/puzzles/[slug]/_e2e/puzzle_test.ts": [
      "routes/puzzles/[slug]/_e2e/puzzle_test.ts",
    ],
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, [
    "e2e/new-user-flow_test.ts",
    "routes/puzzles/[slug]/_e2e/puzzle_test.ts",
  ]);
});

Deno.test("getBlastRadius runs nothing for puzzle content", () => {
  const selected = getBlastRadius(["static/puzzles/boxy.md"], {
    "routes/puzzles/[slug]/_e2e/puzzle_test.ts": [
      "routes/puzzles/[slug]/_e2e/puzzle_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, []);
});

Deno.test("getBlastRadius runs everything when the app shell changes", () => {
  const selected = getBlastRadius(["routes/_app.tsx"], {
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, [
    "e2e/new-user-flow_test.ts",
    "routes/profile/_e2e/profile_test.ts",
  ]);
});

Deno.test("getBlastRadius throws for an unclassified file", () => {
  assertThrows(() =>
    getBlastRadius(["Makefile"], {
      "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
    })
  );
});

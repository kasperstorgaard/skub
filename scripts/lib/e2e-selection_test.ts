import { assertEquals, assertThrows } from "@std/assert";

import { selectE2eTests } from "./e2e-selection.ts";

Deno.test("selectE2eTests runs a changed route's tests and the flows", () => {
  const selected = selectE2eTests(["game/board.ts"], {
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

Deno.test("selectE2eTests runs nothing for puzzle content", () => {
  const selected = selectE2eTests(["static/puzzles/boxy.md"], {
    "routes/puzzles/[slug]/_e2e/puzzle_test.ts": [
      "routes/puzzles/[slug]/_e2e/puzzle_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, []);
});

Deno.test("selectE2eTests runs everything when the app shell changes", () => {
  const selected = selectE2eTests(["routes/_app.tsx"], {
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

Deno.test("selectE2eTests throws for an unclassified file", () => {
  assertThrows(() =>
    selectE2eTests(["Makefile"], {
      "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
    })
  );
});

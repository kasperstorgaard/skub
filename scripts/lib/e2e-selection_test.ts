import { assertEquals } from "@std/assert";

import { selectE2eTests } from "./e2e-selection.ts";

Deno.test("selectE2eTests runs a changed route's own tests and the flows", () => {
  const selected = selectE2eTests(["routes/profile/index.tsx"], {
    "routes/profile/index.tsx": ["routes/profile/index.tsx"],
    "routes/highscore.tsx": ["routes/highscore.tsx"],
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "routes/_e2e/highscore_test.ts": ["routes/_e2e/highscore_test.ts"],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, [
    "e2e/new-user-flow_test.ts",
    "routes/profile/_e2e/profile_test.ts",
  ]);
});

Deno.test("selectE2eTests runs the tests of routes importing a changed module", () => {
  const selected = selectE2eTests(["game/board.ts"], {
    "routes/puzzles/[slug]/index.tsx": [
      "routes/puzzles/[slug]/index.tsx",
      "islands/board.tsx",
      "game/board.ts",
    ],
    "routes/profile/index.tsx": ["routes/profile/index.tsx", "db/user.ts"],
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

Deno.test("selectE2eTests falls back to the nearest _e2e folder above a route", () => {
  const selected = selectE2eTests(["routes/puzzles/[slug]/(actions)/hint.ts"], {
    "routes/puzzles/[slug]/(actions)/hint.ts": [
      "routes/puzzles/[slug]/(actions)/hint.ts",
    ],
    "routes/puzzles/[slug]/_e2e/puzzle_test.ts": [
      "routes/puzzles/[slug]/_e2e/puzzle_test.ts",
    ],
    "routes/puzzles/_e2e/archives_test.ts": [
      "routes/puzzles/_e2e/archives_test.ts",
    ],
  });

  assertEquals(selected, ["routes/puzzles/[slug]/_e2e/puzzle_test.ts"]);
});

Deno.test("selectE2eTests runs only the tests importing a changed page object", () => {
  const selected = selectE2eTests(
    ["routes/puzzles/[slug]/_e2e/puzzle-page.ts"],
    {
      "routes/puzzles/[slug]/index.tsx": ["routes/puzzles/[slug]/index.tsx"],
      "routes/puzzles/[slug]/_e2e/puzzle_test.ts": [
        "routes/puzzles/[slug]/_e2e/puzzle_test.ts",
        "routes/puzzles/[slug]/_e2e/puzzle-page.ts",
      ],
      "routes/profile/_e2e/profile_test.ts": [
        "routes/profile/_e2e/profile_test.ts",
      ],
      "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
    },
  );

  assertEquals(selected, ["routes/puzzles/[slug]/_e2e/puzzle_test.ts"]);
});

Deno.test("selectE2eTests runs every test importing a changed e2e helper", () => {
  const selected = selectE2eTests(["e2e/helpers.ts"], {
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
      "e2e/base.ts",
      "e2e/helpers.ts",
    ],
    "e2e/new-user-flow_test.ts": [
      "e2e/new-user-flow_test.ts",
      "e2e/base.ts",
      "e2e/helpers.ts",
    ],
  });

  assertEquals(selected, [
    "e2e/new-user-flow_test.ts",
    "routes/profile/_e2e/profile_test.ts",
  ]);
});

Deno.test("selectE2eTests runs a changed e2e test on its own", () => {
  const selected = selectE2eTests(["e2e/returning-user-flow_test.ts"], {
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
    "e2e/returning-user-flow_test.ts": ["e2e/returning-user-flow_test.ts"],
  });

  assertEquals(selected, ["e2e/returning-user-flow_test.ts"]);
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

Deno.test("selectE2eTests runs everything when a nested middleware changes", () => {
  const selected = selectE2eTests(["routes/puzzles/[slug]/_middleware.ts"], {
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

Deno.test("selectE2eTests runs everything when the lockfile changes", () => {
  const selected = selectE2eTests(["deno.lock"], {
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

Deno.test("selectE2eTests runs nothing for docs and specs", () => {
  const selected = selectE2eTests(["spec.md", "specs/310-perf.md", "TODO.md"], {
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, []);
});

Deno.test("selectE2eTests runs nothing for a unit test inside a shared folder", () => {
  const selected = selectE2eTests(["plugins/lint-imports_test.ts"], {
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, []);
});

Deno.test("selectE2eTests runs nothing for agent config", () => {
  const selected = selectE2eTests([".claude/skills/testing/SKILL.ts"], {
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, []);
});

Deno.test("selectE2eTests runs nothing for files no route imports", () => {
  const selected = selectE2eTests(["scripts/score-corpus.ts"], {
    "routes/profile/index.tsx": ["routes/profile/index.tsx"],
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, []);
});

Deno.test("selectE2eTests runs the puzzle route tests and flows for puzzle content", () => {
  const selected = selectE2eTests(["static/puzzles/boxy.md"], {
    "routes/puzzles/[slug]/_e2e/puzzle_test.ts": [
      "routes/puzzles/[slug]/_e2e/puzzle_test.ts",
    ],
    "routes/puzzles/_e2e/archives_test.ts": [
      "routes/puzzles/_e2e/archives_test.ts",
    ],
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "e2e/new-user-flow_test.ts": ["e2e/new-user-flow_test.ts"],
  });

  assertEquals(selected, [
    "e2e/new-user-flow_test.ts",
    "routes/puzzles/[slug]/_e2e/puzzle_test.ts",
    "routes/puzzles/_e2e/archives_test.ts",
  ]);
});

Deno.test("selectE2eTests runs a deleted route's nearest tests", () => {
  const selected = selectE2eTests(["routes/profile/edit.tsx"], {
    "routes/profile/index.tsx": ["routes/profile/index.tsx"],
    "routes/profile/_e2e/profile_test.ts": [
      "routes/profile/_e2e/profile_test.ts",
    ],
    "routes/_e2e/home_test.ts": ["routes/_e2e/home_test.ts"],
  });

  assertEquals(selected, ["routes/profile/_e2e/profile_test.ts"]);
});

Deno.test("selectE2eTests runs every test when a stylesheet changed", () => {
  const selected = selectE2eTests(["styles/tokens.css"], {
    "routes/profile/index.tsx": ["routes/profile/index.tsx"],
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

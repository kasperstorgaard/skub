import { assertEquals } from "@std/assert";

import { pickCelebrationAction } from "#/game/celebration.ts";

Deno.test("pickCelebrationAction — a player's first solve offers another puzzle", () => {
  assertEquals(
    pickCelebrationAction("puzzle-1", {
      userId: "fresh",
      solvedCount: 1,
      isRated: false,
    }),
    "play",
  );
});

Deno.test("pickCelebrationAction — a player's second solve asks for a rating", () => {
  assertEquals(
    pickCelebrationAction("puzzle-1", {
      userId: "fresh",
      solvedCount: 2,
      isRated: false,
    }),
    "rate",
  );
});

Deno.test("pickCelebrationAction — a second solve already rated offers another puzzle", () => {
  assertEquals(
    pickCelebrationAction("puzzle-1", {
      userId: "fresh",
      solvedCount: 2,
      isRated: true,
    }),
    "play",
  );
});

Deno.test("pickCelebrationAction — a regular gets a third each of rate, build and play", () => {
  const counts = { play: 0, rate: 0, build: 0 };
  for (let i = 0; i < 600; i++) {
    const action = pickCelebrationAction(`puzzle-${i}`, {
      userId: "regular",
      solvedCount: 40,
      isRated: false,
    });
    counts[action]++;
  }

  assertEquals(
    [counts.play, counts.rate, counts.build].map((count) =>
      count > 600 * 0.27 && count < 600 * 0.4
    ),
    [true, true, true],
    JSON.stringify(counts),
  );
});

Deno.test("pickCelebrationAction — a regular is never asked to rate a puzzle already rated", () => {
  const actions = new Set<string>();
  for (let i = 0; i < 600; i++) {
    actions.add(pickCelebrationAction(`puzzle-${i}`, {
      userId: "regular",
      solvedCount: 40,
      isRated: true,
    }));
  }

  assertEquals(actions.has("rate"), false);
});

Deno.test("pickCelebrationAction — the same player and puzzle get the same pick as solves add up", () => {
  const at40 = Array.from(
    { length: 30 },
    (_, i) =>
      pickCelebrationAction(`puzzle-${i}`, {
        userId: "regular",
        solvedCount: 40,
        isRated: false,
      }),
  );
  const at41 = Array.from(
    { length: 30 },
    (_, i) =>
      pickCelebrationAction(`puzzle-${i}`, {
        userId: "regular",
        solvedCount: 41,
        isRated: false,
      }),
  );

  assertEquals(at40, at41);
});

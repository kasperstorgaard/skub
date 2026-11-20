import { assertEquals } from "@std/assert";

import {
  type CelebrationAction,
  pickCelebrationAction,
} from "#/game/celebration.ts";

const slugs = Array.from({ length: 600 }, (_, i) => `puzzle-${i}`);

const shares = (options: Parameters<typeof pickCelebrationAction>[1]) => {
  const counts: Record<CelebrationAction, number> = {
    play: 0,
    rate: 0,
    build: 0,
  };
  for (const slug of slugs) counts[pickCelebrationAction(slug, options)]++;
  return {
    play: counts.play / slugs.length,
    rate: counts.rate / slugs.length,
    build: counts.build / slugs.length,
  };
};

const isAboutAThird = (share: number) => share > 0.27 && share < 0.4;

Deno.test("pickCelebrationAction — a player's first solve offers another puzzle", () => {
  assertEquals(
    shares({ userId: "fresh", solvedCount: 1, isRated: false }).play,
    1,
  );
});

Deno.test("pickCelebrationAction — a player's second solve asks for a rating", () => {
  assertEquals(
    shares({ userId: "fresh", solvedCount: 2, isRated: false }).rate,
    1,
  );
});

Deno.test("pickCelebrationAction — a regular gets a third each of rate, build and play", () => {
  const { play, rate, build } = shares({
    userId: "regular",
    solvedCount: 40,
    isRated: false,
  });
  assertEquals(
    [isAboutAThird(play), isAboutAThird(rate), isAboutAThird(build)],
    [true, true, true],
    `play ${play}, rate ${rate}, build ${build}`,
  );
});

Deno.test("pickCelebrationAction — never asks to rate a puzzle already rated", () => {
  assertEquals(
    shares({ userId: "regular", solvedCount: 40, isRated: true }).rate,
    0,
  );
  assertEquals(
    shares({ userId: "fresh", solvedCount: 2, isRated: true }).play,
    1,
  );
});

Deno.test("pickCelebrationAction — the same player and puzzle get the same pick", () => {
  const options = { userId: "regular", solvedCount: 40, isRated: false };
  for (const slug of slugs.slice(0, 30)) {
    assertEquals(
      pickCelebrationAction(slug, options),
      pickCelebrationAction(slug, { ...options, solvedCount: 41 }),
    );
  }
});

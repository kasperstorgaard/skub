import { assertEquals } from "@std/assert";

import { parseRating, shouldAskRating } from "#/game/feedback.ts";

const slugs = Array.from({ length: 600 }, (_, i) => `puzzle-${i}`);

const askedShare = (options: Parameters<typeof shouldAskRating>[1]) =>
  slugs.filter((slug) => shouldAskRating(slug, options)).length /
  slugs.length;

Deno.test("shouldAskRating — a player's first solve keeps Play one more", () => {
  assertEquals(
    askedShare({ userId: "fresh", solvedCount: 1, isRated: false }),
    0,
  );
});

Deno.test("shouldAskRating — always asks on a player's second solve", () => {
  assertEquals(
    askedShare({ userId: "fresh", solvedCount: 2, isRated: false }),
    1,
  );
});

Deno.test("shouldAskRating — a regular is asked about one in three", () => {
  const share = askedShare({
    userId: "regular",
    solvedCount: 40,
    isRated: false,
  });
  assertEquals(share > 0.27 && share < 0.4, true, `asked ${share}`);
});

Deno.test("shouldAskRating — the same player and puzzle get the same answer", () => {
  const options = { userId: "regular", solvedCount: 40, isRated: false };
  for (const slug of slugs.slice(0, 30)) {
    assertEquals(
      shouldAskRating(slug, options),
      shouldAskRating(slug, { ...options, solvedCount: 41 }),
    );
  }
});

Deno.test("shouldAskRating — never asks about a puzzle already rated", () => {
  assertEquals(
    askedShare({ userId: "fresh", solvedCount: 2, isRated: true }),
    0,
  );
});

Deno.test("parseRating — reads difficulty and liked", () => {
  const form = new FormData();
  form.set("difficulty", "hard");
  form.set("liked", "no");
  assertEquals(parseRating(form), { difficulty: "hard", liked: false });
});

Deno.test("parseRating — only liked picked", () => {
  const form = new FormData();
  form.set("liked", "yes");
  assertEquals(parseRating(form), { liked: true });
});

Deno.test("parseRating — nothing picked, or values it doesn't know", () => {
  const form = new FormData();
  form.set("difficulty", "brutal");
  form.set("message", "Nice one");
  assertEquals(parseRating(form), undefined);
});

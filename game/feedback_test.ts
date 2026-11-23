import { assertEquals } from "@std/assert";

import { parseRating } from "#/game/feedback.ts";

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

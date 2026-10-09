import { assertEquals } from "@std/assert";

import { getReturnTo } from "./return-to.ts";

const ORIGIN = "https://skub.app";

Deno.test("getReturnTo - keeps a same-origin path with query and hash", () => {
  assertEquals(
    getReturnTo("/puzzles?date=2026-10-09#top", ORIGIN),
    "/puzzles?date=2026-10-09#top",
  );
});

Deno.test("getReturnTo - defaults to the root when absent", () => {
  assertEquals(getReturnTo(null, ORIGIN), "/");
});

Deno.test("getReturnTo - rejects a protocol-relative host", () => {
  assertEquals(getReturnTo("//evil.example/profile", ORIGIN), "/");
});

Deno.test("getReturnTo - rejects a backslash-escaped host", () => {
  assertEquals(getReturnTo("/\\evil.example/profile", ORIGIN), "/");
});

Deno.test("getReturnTo - rejects an absolute URL on another origin", () => {
  assertEquals(getReturnTo("https://evil.example/profile", ORIGIN), "/");
});

Deno.test("getReturnTo - rejects a non-http scheme", () => {
  assertEquals(getReturnTo("javascript:alert(1)", ORIGIN), "/");
});

Deno.test("getReturnTo - accepts an absolute URL on the same origin", () => {
  assertEquals(getReturnTo("https://skub.app/profile", ORIGIN), "/profile");
});

Deno.test("getReturnTo - resolves a bare relative path against the origin", () => {
  assertEquals(getReturnTo("profile", ORIGIN), "/profile");
});

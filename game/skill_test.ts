import { assertEquals } from "@std/assert";
import { assessSkillLevel } from "#/game/skill.ts";
import type { Move } from "#/game/types.ts";

const p = (x: number, y: number) => ({ x, y });
const move = (moves: number): Move[] =>
  Array.from({ length: moves }, (_, i) => [p(i, 0), p(i + 1, 0)]);

// -- expert promotion ---

Deno.test("medium puzzle solved perfectly promotes to expert", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    move(6),
  );
  assertEquals(result, "expert");
});

Deno.test("hard puzzle solved perfectly promotes to expert", () => {
  const result = assessSkillLevel(
    { difficulty: "hard", minMoves: 8 },
    move(8),
  );
  assertEquals(result, "expert");
});

Deno.test("medium solved above optimal does not promote to expert", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    move(7),
    { current: "intermediate" },
  );
  assertEquals(result, "intermediate");
});

Deno.test("already-expert stays expert after perfect medium solve", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    move(6),
    { current: "expert" },
  );
  assertEquals(result, "expert");
});

// -- intermediate promotion ---

Deno.test("medium solved within 1.33x optimal promotes to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    move(7), // 7 / 6 = 1.166 — within 1.33x
  );
  assertEquals(result, "intermediate");
});

Deno.test("medium solved at exactly 1.33x optimal promotes to intermediate", () => {
  // minMoves=6, threshold=7.98 → 7 moves is within, 8 is above
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    move(7),
  );
  assertEquals(result, "intermediate");
});

Deno.test("medium solved above 1.33x optimal does not promote to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    move(9), // 9 > 6 * 1.33 = 7.98
  );
  assertEquals(result, "beginner");
});

Deno.test("easy puzzle solved perfectly with minMoves > 5 promotes to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 6 },
    move(6),
  );
  assertEquals(result, "intermediate");
});

Deno.test("easy puzzle solved perfectly with minMoves <= 5 does not promote to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 5 },
    move(5),
  );
  assertEquals(result, "beginner");
});

Deno.test("easy puzzle solved above optimal does not promote to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 6 },
    move(7),
  );
  assertEquals(result, "beginner");
});

Deno.test("already-intermediate stays intermediate — no double-promotion check", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    move(7),
    { current: "intermediate" },
  );
  assertEquals(result, "intermediate");
});

Deno.test("expert is not demoted by a sub-optimal solve", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    move(7),
    { current: "expert" },
  );
  assertEquals(result, "expert");
});

// -- beginner promotion ---

Deno.test("any solve with no prior skill level yields beginner", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 3 },
    move(5),
  );
  assertEquals(result, "beginner");
});

Deno.test("defaults to null current when no options passed", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 3 },
    move(10),
  );
  assertEquals(result, "beginner");
});

// -- idempotency / no-op ---

Deno.test("returns current level when no promotion applies", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 3 },
    move(5),
    { current: "beginner" },
  );
  assertEquals(result, "beginner");
});

Deno.test("returns current intermediate when solve does not qualify for expert", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 3 },
    move(4),
    { current: "intermediate" },
  );
  assertEquals(result, "intermediate");
});

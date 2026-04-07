import { assertEquals } from "@std/assert";

import { assessSkillLevel } from "#/game/skill.ts";
import type { Move } from "#/game/types.ts";

const moves = (moves: number): Move[] =>
  Array.from({ length: moves }, (_) => [{ x: 0, y: 0 }, { x: 1, y: 0 }]);

// -- expert promotion ---

Deno.test("medium puzzle solved perfectly promotes to expert", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(6),
  );
  assertEquals(result, "expert");
});

Deno.test("hard puzzle solved perfectly promotes to expert", () => {
  const result = assessSkillLevel(
    { difficulty: "hard", minMoves: 8 },
    moves(8),
  );
  assertEquals(result, "expert");
});

Deno.test("medium solved above optimal does not promote to expert", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(7),
    { current: "intermediate" },
  );
  assertEquals(result, "intermediate");
});

Deno.test("already-expert stays expert after perfect medium solve", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(6),
    { current: "expert" },
  );
  assertEquals(result, "expert");
});

// -- intermediate promotion ---

Deno.test("medium solved within +3 optimal promotes to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(7),
  );
  assertEquals(result, "intermediate");
});

Deno.test("hard solved within +3 optimal promotes to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(7),
  );
  assertEquals(result, "intermediate");
});

Deno.test("medium solved at +3 optimal promotes to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(9),
  );
  assertEquals(result, "intermediate");
});

Deno.test("hard solved at +3 optimal promotes to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "hard", minMoves: 6 },
    moves(9),
  );
  assertEquals(result, "intermediate");
});

Deno.test("medium solved above +3 optimal does not promote to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(10),
  );
  assertEquals(result, "beginner");
});

Deno.test("easy puzzle solved perfectly with minMoves > 5 promotes to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 6 },
    moves(6),
  );
  assertEquals(result, "intermediate");
});

Deno.test("easy puzzle solved perfectly with minMoves <= 5 does not promote to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 5 },
    moves(5),
  );
  assertEquals(result, "beginner");
});

Deno.test("easy puzzle solved above optimal does not promote to intermediate", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 6 },
    moves(7),
  );
  assertEquals(result, "beginner");
});

Deno.test("already-intermediate stays intermediate — no double-promotion check", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(7),
    { current: "intermediate" },
  );
  assertEquals(result, "intermediate");
});

Deno.test("expert is not demoted by a sub-optimal solve", () => {
  const result = assessSkillLevel(
    { difficulty: "medium", minMoves: 6 },
    moves(7),
    { current: "expert" },
  );
  assertEquals(result, "expert");
});

// -- beginner promotion ---

Deno.test("any solve with no prior skill level yields beginner", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 3 },
    moves(5),
  );
  assertEquals(result, "beginner");
});

Deno.test("defaults to null current when no options passed", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 3 },
    moves(10),
  );
  assertEquals(result, "beginner");
});

// -- idempotency / no-op ---

Deno.test("returns current level when no promotion applies", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 3 },
    moves(5),
    { current: "beginner" },
  );
  assertEquals(result, "beginner");
});

Deno.test("returns current intermediate when solve does not qualify for expert", () => {
  const result = assessSkillLevel(
    { difficulty: "easy", minMoves: 3 },
    moves(4),
    { current: "intermediate" },
  );
  assertEquals(result, "intermediate");
});

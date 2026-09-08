import { assertEquals, assertStringIncludes } from "@std/assert";

import { buildDiceKeyframes, diceDuration } from "./dice.ts";

Deno.test("buildDiceKeyframes() holds a die that landed on its first throw", () => {
  const css = buildDiceKeyframes("puck", [{ x: 3, y: 5 }], 1);

  assertStringIncludes(css, "@keyframes dice-puck-1 {");
  assertStringIncludes(css, "0% { --x: 3; --y: 5;");
  assertStringIncludes(css, "100% { --x: 3; --y: 5; }");
});

Deno.test("buildDiceKeyframes() steps between throws rather than gliding", () => {
  const css = buildDiceKeyframes("destination", [{ x: 0, y: 0 }, {
    x: 7,
    y: 7,
  }], 2);

  // A fraction of --x between the two would place the destination off its grid
  // line, so every frame has to hold a whole cell.
  assertStringIncludes(css, "0% { --x: 0; --y: 0;");
  assertStringIncludes(css, "animation-timing-function: steps(1, end);");
  assertStringIncludes(css, "100% { --x: 7; --y: 7; }");
});

Deno.test("buildDiceKeyframes() drops the die onto every cell it was thrown at", () => {
  const css = buildDiceKeyframes("puck", [{ x: 1, y: 1 }, { x: 2, y: 2 }, {
    x: 3,
    y: 3,
  }], 4);

  assertStringIncludes(css, "@keyframes dice-puck-4-drop {");
  // One drop per throw.
  assertEquals(css.match(/scale: 1\.12;/g)?.length, 3);
  // Only the last of them comes up solid.
  assertEquals(css.match(/opacity: 1;/g)?.length, 2);
});

Deno.test("diceDuration() gives a miss its own beat on the board", () => {
  const landed = diceDuration([{ x: 0, y: 0 }]);
  const missed = diceDuration([{ x: 0, y: 0 }, { x: 1, y: 1 }]);

  assertEquals(missed > landed, true);
});

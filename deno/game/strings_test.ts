import { assertEquals, assertThrows } from "@std/assert";

import {
  decodeMove,
  decodeMoves,
  decodePosition,
  encodeMove,
  encodeMoves,
  encodePosition,
} from "#/game/strings.ts";

Deno.test("encodePosition() should encode position (0,0) as A1", () => {
  const result = encodePosition({ x: 0, y: 0 });
  assertEquals(result, "A1");
});

Deno.test("encodePosition() should encode position (7,7) as H8", () => {
  const result = encodePosition({ x: 7, y: 7 });
  assertEquals(result, "H8");
});

Deno.test("encodePosition() should encode position (2,5) as C6", () => {
  const result = encodePosition({ x: 2, y: 5 });
  assertEquals(result, "C6");
});

Deno.test("encodePosition() should throw when x is out of bounds", () => {
  assertThrows(() => encodePosition({ x: 8, y: 0 }));
  assertThrows(() => encodePosition({ x: -1, y: 0 }));
});

Deno.test("encodePosition() should throw when y is out of bounds", () => {
  assertThrows(() => encodePosition({ x: 0, y: 8 }));
  assertThrows(() => encodePosition({ x: 0, y: -1 }));
});

Deno.test("decodePosition() should decode A1 to (0,0)", () => {
  const result = decodePosition("A1");
  assertEquals(result, { x: 0, y: 0 });
});

Deno.test("decodePosition() should decode H8 to (7,7)", () => {
  const result = decodePosition("H8");
  assertEquals(result, { x: 7, y: 7 });
});

Deno.test("decodePosition() should decode C6 to (2,5)", () => {
  const result = decodePosition("C6");
  assertEquals(result, { x: 2, y: 5 });
});

Deno.test("decodePosition() should be case insensitive", () => {
  const result = decodePosition("c6");
  assertEquals(result, { x: 2, y: 5 });
});

Deno.test("decodePosition() should throw on invalid format", () => {
  assertThrows(() => decodePosition("ABC"));
  assertThrows(() => decodePosition("A"));
  assertThrows(() => decodePosition(""));
});

Deno.test("decodePosition() should throw on invalid column", () => {
  assertThrows(() => decodePosition("I1"));
  assertThrows(() => decodePosition("Z5"));
});

Deno.test("decodePosition() should throw on invalid row", () => {
  assertThrows(() => decodePosition("A0"));
  assertThrows(() => decodePosition("A9"));
  assertThrows(() => decodePosition("AX"));
});

Deno.test("encodeMove() should encode a move", () => {
  const result = encodeMove([{ x: 5, y: 2 }, { x: 5, y: 6 }]);
  assertEquals(result, "F3F7");
});

Deno.test("decodeMove() should decode a move", () => {
  const result = decodeMove("A1H8");
  assertEquals(result, [
    { x: 0, y: 0 },
    { x: 7, y: 7 },
  ]);
});

Deno.test("encodeMoves() should encode moves with shorthand", () => {
  const result = encodeMoves(
    [
      [{ x: 0, y: 0 }, { x: 0, y: 5 }],
      [{ x: 0, y: 5 }, { x: 5, y: 5 }],
      [{ x: 5, y: 5 }, { x: 5, y: 2 }],
      [{ x: 5, y: 2 }, { x: 5, y: 0 }],
    ],
  );

  // Shorthand: A1A6-F6-F3-F1 (second+ moves omit starting position if continuous)
  assertEquals(result, "A1A6-F6-F3-F1");
});

Deno.test("encodeMoves() should encode non-continuous moves without shorthand", () => {
  const result = encodeMoves(
    [
      [{ x: 0, y: 0 }, { x: 0, y: 5 }],
      [{ x: 2, y: 3 }, { x: 5, y: 3 }], // Doesn't start where previous ended
    ],
  );

  assertEquals(result, "A1A6-C4F4");
});

Deno.test("decodeMoves() should decode shorthand notation", () => {
  const result = decodeMoves("F6F3-F1");

  assertEquals(result, [
    [{ x: 5, y: 5 }, { x: 5, y: 2 }],
    [{ x: 5, y: 2 }, { x: 5, y: 0 }],
  ]);
});

Deno.test("encodeMoves() should write the portal a slide went in by", () => {
  const result = encodeMoves([
    [{ x: 7, y: 6 }, { x: 7, y: 7 }],
    [{ x: 7, y: 7 }, { x: 0, y: 0 }, { x: 0, y: 7 }],
  ]);

  // Slid west off H8 into the portal on A8, and came to rest on A1.
  assertEquals(result, "H7H8-A8xA1");
});

Deno.test("encodeMoves() should write a portal slide in full when it starts fresh", () => {
  const result = encodeMoves([
    [{ x: 0, y: 0 }, { x: 0, y: 5 }],
    [{ x: 7, y: 7 }, { x: 0, y: 0 }, { x: 0, y: 7 }],
  ]);

  assertEquals(result, "A1A6-H8A8xA1");
});

Deno.test("decodeMoves() should read back the portal a slide went in by", () => {
  const result = decodeMoves("H7H8-A8xA1");

  assertEquals(result, [
    [{ x: 7, y: 6 }, { x: 7, y: 7 }],
    [{ x: 7, y: 7 }, { x: 0, y: 0 }, { x: 0, y: 7 }],
  ]);
});

Deno.test("decodeMoves() should decode mixed full and shorthand notation", () => {
  const result = decodeMoves("A1A6-F6-C4F4");

  assertEquals(result, [
    [{ x: 0, y: 0 }, { x: 0, y: 5 }],
    [{ x: 0, y: 5 }, { x: 5, y: 5 }],
    [{ x: 2, y: 3 }, { x: 5, y: 3 }],
  ]);
});

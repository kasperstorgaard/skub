import { assertEquals } from "@std/assert";

import { type GesturePoint, readGesture } from "./touch.ts";

// 8x8 board of 50px cells at (20, 20), swipe region 20px around it.
const region = { left: 0, top: 0, width: 440, height: 440 };

const at = (x: number, y: number, time: number): GesturePoint => ({
  x,
  y,
  time,
});

Deno.test("readGesture() reads a fast drag to the right as a swipe right", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(110, 100, 16), at(140, 100, 32), at(180, 100, 48)],
    end: at(180, 100, 60),
    region,
  });

  assertEquals(gesture, {
    swipe: { direction: "right", velocity: 2.5 },
    isTap: false,
  });
});

Deno.test("readGesture() reads a fast drag upwards as a swipe up", () => {
  const gesture = readGesture({
    start: at(100, 300, 0),
    moves: [at(100, 290, 16), at(100, 260, 32), at(100, 220, 48)],
    end: at(100, 220, 60),
    region,
  });

  assertEquals(gesture.swipe, { direction: "up", velocity: 2.5 });
});

Deno.test("readGesture() needs at least three moves for a swipe", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(140, 100, 16), at(180, 100, 32)],
    end: at(180, 100, 40),
    region,
  });

  assertEquals(gesture.swipe, null);
});

Deno.test("readGesture() still swipes when lifted exactly 100ms after the last move", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(110, 100, 16), at(140, 100, 32), at(180, 100, 48)],
    end: at(180, 100, 148),
    region,
  });

  assertEquals(gesture.swipe, { direction: "right", velocity: 2.5 });
});

Deno.test("readGesture() drops the swipe when the finger rests over 100ms before lifting", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(110, 100, 16), at(140, 100, 32), at(180, 100, 48)],
    end: at(180, 100, 149),
    region,
  });

  assertEquals(gesture.swipe, null);
});

Deno.test("readGesture() swipes at exactly the escape velocity", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(102, 100, 16), at(106, 100, 32), at(110, 100, 48)],
    end: at(110, 100, 60),
    region,
  });

  assertEquals(gesture.swipe, { direction: "right", velocity: 0.25 });
});

Deno.test("readGesture() ignores a final segment slower than the escape velocity", () => {
  // A long fast drag that slows down at the end.
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(180, 100, 16), at(260, 100, 32), at(263, 100, 48)],
    end: at(263, 100, 60),
    region,
  });

  assertEquals(gesture.swipe, null);
});

Deno.test("readGesture() takes the direction from the final segment, not the whole drag", () => {
  // Drags right, then flicks down.
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(200, 100, 16), at(300, 100, 32), at(300, 140, 48)],
    end: at(300, 140, 60),
    region,
  });

  assertEquals(gesture.swipe, { direction: "down", velocity: 2.5 });
});

Deno.test("readGesture() resolves an exact up-right diagonal to up", () => {
  const gesture = readGesture({
    start: at(100, 300, 0),
    moves: [at(110, 290, 16), at(130, 270, 32), at(160, 240, 48)],
    end: at(160, 240, 60),
    region,
  });

  assertEquals(gesture.swipe?.direction, "up");
});

Deno.test("readGesture() resolves an exact down-right diagonal to right", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(110, 110, 16), at(130, 130, 32), at(160, 160, 48)],
    end: at(160, 160, 60),
    region,
  });

  assertEquals(gesture.swipe?.direction, "right");
});

Deno.test("readGesture() measures velocity against the last move with a different timestamp", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [
      at(110, 100, 16),
      at(140, 100, 32),
      at(160, 100, 48),
      at(180, 100, 48),
    ],
    end: at(180, 100, 60),
    region,
  });

  assertEquals(gesture.swipe, { direction: "right", velocity: 2.5 });
});

Deno.test("readGesture() reads velocity from sub-millisecond timestamps", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(110, 100, 10), at(120, 100, 16.5), at(133, 100, 23)],
    end: at(133, 100, 30),
    region,
  });

  assertEquals(gesture.swipe, { direction: "right", velocity: 2 });
});

Deno.test("readGesture() reads a quick touch without movement as a tap", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [],
    end: at(100, 100, 80),
    region,
  });

  assertEquals(gesture, { swipe: null, isTap: true });
});

Deno.test("readGesture() still taps when lifted exactly 300ms after touching down", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [],
    end: at(100, 100, 300),
    region,
  });

  assertEquals(gesture.isTap, true);
});

Deno.test("readGesture() does not tap when held longer than 300ms", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [],
    end: at(100, 100, 301),
    region,
  });

  assertEquals(gesture.isTap, false);
});

Deno.test("readGesture() still taps when each step moves at most 10px", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(110, 90, 16), at(120, 80, 32)],
    end: at(120, 80, 60),
    region,
  });

  assertEquals(gesture.isTap, true);
});

Deno.test("readGesture() does not tap when one step moves over 10px", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(111, 100, 16)],
    end: at(111, 100, 60),
    region,
  });

  assertEquals(gesture.isTap, false);
});

Deno.test("readGesture() reads a quick small flick as both a swipe and a tap", () => {
  const gesture = readGesture({
    start: at(100, 100, 0),
    moves: [at(105, 100, 16), at(110, 100, 32), at(115, 100, 48)],
    end: at(115, 100, 60),
    region,
  });

  assertEquals(gesture, {
    swipe: { direction: "right", velocity: 0.3125 },
    isTap: true,
  });
});

Deno.test("readGesture() drops the gesture when a move leaves the region", () => {
  const gesture = readGesture({
    start: at(380, 100, 0),
    moves: [at(400, 100, 16), at(440, 100, 32), at(480, 100, 48)],
    end: at(480, 100, 60),
    region,
  });

  assertEquals(gesture, { swipe: null, isTap: false });
});

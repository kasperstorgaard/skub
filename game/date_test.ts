import { assertEquals } from "@std/assert";

import { getPuzzleNumber, getWeekPuzzleNumbers } from "./date.ts";

Deno.test("getPuzzleNumber - the start date is slot 1", () => {
  assertEquals(getPuzzleNumber(new Date(2026, 0, 1)), 1);
  assertEquals(getPuzzleNumber(new Date(2026, 0, 31)), 31);
});

Deno.test("getPuzzleNumber - keeps counting across the new year", () => {
  // The reason this isn't day-of-year: numbers pass 366, so a slot that reset
  // every January would unrelease the whole archive.
  assertEquals(getPuzzleNumber(new Date(2026, 11, 31)), 365);
  assertEquals(getPuzzleNumber(new Date(2027, 0, 1)), 366);
});

Deno.test("getPuzzleNumber - counts leap days in the years it spans", () => {
  // 2028 is a leap year, so 2029 starts a day later than three flat years.
  assertEquals(getPuzzleNumber(new Date(2029, 0, 1)), 365 * 3 + 1 + 1);
});

Deno.test("getPuzzleNumber - accepts a plain date", () => {
  assertEquals(
    getPuzzleNumber(Temporal.PlainDate.from("2026-08-30")),
    getPuzzleNumber(new Date(2026, 7, 30)),
  );
});

Deno.test("getWeekPuzzleNumbers() runs from Monday to Sunday", () => {
  // Saturday 7 November 2026: the week of Monday the 2nd to Sunday the 8th.
  assertEquals(getWeekPuzzleNumbers(Temporal.PlainDate.from("2026-11-07")), {
    from: getPuzzleNumber(Temporal.PlainDate.from("2026-11-02")),
    to: getPuzzleNumber(Temporal.PlainDate.from("2026-11-08")),
  });
});

Deno.test("getWeekPuzzleNumbers() starts a week on its Monday", () => {
  assertEquals(
    getWeekPuzzleNumbers(Temporal.PlainDate.from("2026-11-02")).from,
    getPuzzleNumber(Temporal.PlainDate.from("2026-11-02")),
  );
});

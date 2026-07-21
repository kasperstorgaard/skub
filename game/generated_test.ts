import { assertEquals } from "@std/assert/equals";

import {
  formatGenerated,
  type GeneratedCandidate,
  parseGenerated,
  type ReasonTag,
} from "./generated.ts";

const baseCandidate = (): GeneratedCandidate => ({
  number: 0,
  name: "Untitled",
  slug: "gen-123",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  difficulty: "medium",
  minMoves: 8,
  board: {
    destination: { x: 3, y: 3 },
    pieces: [
      { x: 1, y: 1, type: "puck" },
      { x: 5, y: 5, type: "blocker" },
    ],
    walls: [{ x: 2, y: 2, orientation: "vertical" }],
  },
  genOptions: {
    difficulty: "medium",
    wallsRange: [5, 15],
    blockersRange: [3, 5],
    wallSpread: "balanced",
    symmetry: 0.5,
  },
  generatorVersion: "0.5",
});

Deno.test("formatGenerated → parseGenerated round-trips feedback + provenance", () => {
  const candidate: GeneratedCandidate = {
    ...baseCandidate(),
    rating: 2,
    reasons: ["clumped", "empty-areas"] as ReasonTag[],
    note: "huddles in one corner",
  };

  const parsed = parseGenerated(formatGenerated(candidate));

  assertEquals(parsed.rating, 2);
  assertEquals(parsed.reasons, ["clumped", "empty-areas"]);
  assertEquals(parsed.note, "huddles in one corner");
  assertEquals(parsed.genOptions, candidate.genOptions);
  assertEquals(parsed.generatorVersion, "0.5");
  assertEquals(parsed.board, candidate.board);
});

Deno.test("an unrated candidate omits rating cleanly", () => {
  const parsed = parseGenerated(formatGenerated(baseCandidate()));

  assertEquals(parsed.rating, undefined);
  // Provenance still round-trips even without any feedback.
  assertEquals(parsed.generatorVersion, "0.5");
  assertEquals(parsed.genOptions?.symmetry, 0.5);
});

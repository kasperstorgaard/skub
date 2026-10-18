import { assertEquals } from "@std/assert/equals";

import {
  type Candidate,
  candidateFamilies,
  candidateLabel,
  candidateSource,
  formatCandidate,
  nextCandidateNumber,
  parseCandidate,
  promoteTarget,
  type ReasonTag,
  shippedFrom,
  storedSolutionMoves,
  stripVariant,
  toStoredScoring,
} from "./candidates.ts";
import { CALIBRATION, type Metrics, type ScoredBoard } from "#/game/scoring.ts";
import type { Move } from "#/game/types.ts";

const baseCandidate = (): Candidate => ({
  number: 0,
  name: "Untitled",
  slug: "gen-123",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  difficulty: "medium",
  minMoves: 8,
  board: {
    holes: [],
    portals: [],
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

Deno.test("formatCandidate → parseCandidate round-trips feedback + provenance", () => {
  const candidate: Candidate = {
    ...baseCandidate(),
    rating: 2,
    reasons: ["clumped", "empty-areas"] as ReasonTag[],
    note: "huddles in one corner",
  };

  const parsed = parseCandidate(formatCandidate(candidate));

  assertEquals(parsed.rating, 2);
  assertEquals(parsed.reasons, ["clumped", "empty-areas"]);
  assertEquals(parsed.note, "huddles in one corner");
  assertEquals(parsed.genOptions, candidate.genOptions);
  assertEquals(parsed.generatorVersion, "0.5");
  assertEquals(parsed.board, candidate.board);
});

Deno.test("an unrated candidate omits rating cleanly", () => {
  const parsed = parseCandidate(formatCandidate(baseCandidate()));

  assertEquals(parsed.rating, undefined);
  // Provenance still round-trips even without any feedback.
  assertEquals(parsed.generatorVersion, "0.5");
  assertEquals(parsed.genOptions?.symmetry, 0.5);
});

/** Every metric at a distinguishable value, so a dropped key shows up. */
const metricsAt = (base: number): Metrics => ({
  setupRatio: base,
  coverage: base + 0.01,
  deception: base + 0.02,
  reversals: 1,
  crossTrailOverlap: 2,
  totalDistance: 20,
  pieceUsage: base + 0.03,
  stopWeighted: 12,
  pointlessClearance: 0,
  sameDirectionRepeat: 0,
  openingSetup: 1,
  uniqueSolutions: 2,
  wallUtilization: base + 0.04,
  deadSpace: base + 0.05,
  puckPathVariety: 0.5,
  clumping: base + 0.06,
  emptyRegion: base + 0.07,
  wallSymmetry: base + 0.08,
  firstMovePrecision: 0.25,
  searchProfile: base + 0.09,
  isolationGap: 2,
  nearMissCount: 1,
});

const routeA: Move[] = [[{ x: 1, y: 1 }, { x: 1, y: 5 }], [{ x: 1, y: 5 }, {
  x: 4,
  y: 5,
}]];
const routeB: Move[] = [[{ x: 5, y: 5 }, { x: 5, y: 0 }]];

const scoredBoard = (): ScoredBoard => ({
  score: 0.4123456,
  mean: 0.4123456,
  min: 0.3,
  stddev: 0.05,
  perSolution: [
    { moves: routeA, metrics: metricsAt(0.3), score: 0.3 },
    { moves: routeB, metrics: metricsAt(0.5), score: 0.5246913 },
  ],
});

Deno.test("a candidate's scoring survives the trip through markdown", () => {
  const candidate: Candidate = {
    ...baseCandidate(),
    scoring: toStoredScoring(scoredBoard(), metricsAt(0.4)),
  };

  const parsed = parseCandidate(formatCandidate(candidate));

  // Rounded for a readable diff, not truncated to uselessness.
  assertEquals(parsed.scoring?.score, 0.4123);
  assertEquals(parsed.scoring?.min, 0.3);
  assertEquals(parsed.scoring?.metrics, candidate.scoring?.metrics);
  assertEquals(parsed.scoring?.calibrationVersion, CALIBRATION.version);
  assertEquals(parsed.scoring?.solutions.length, 2);
  assertEquals(parsed.scoring?.solutions[1].score, 0.5247);
  assertEquals(
    parsed.scoring?.solutions[0].metrics,
    candidate.scoring?.solutions[0].metrics,
  );
  // The stored move encoding is the URL's, and decodes back to the routes.
  assertEquals(storedSolutionMoves(parsed.scoring!), [routeA, routeB]);
});

Deno.test("per-route tags round-trip keyed by their moves", () => {
  const scoring = toStoredScoring(scoredBoard(), metricsAt(0.4));
  const candidate: Candidate = {
    ...baseCandidate(),
    rating: 4,
    scoring,
    solutionTags: {
      [scoring.solutions[0].moves]: ["interesting", "unique"],
      [scoring.solutions[1].moves]: ["too-easy", "boring"],
    },
  };

  const parsed = parseCandidate(formatCandidate(candidate));

  assertEquals(parsed.solutionTags, candidate.solutionTags);
  // The puzzle-level rating is untouched by a route being labelled.
  assertEquals(parsed.rating, 4);
});

Deno.test("a candidate's source round-trips through markdown", () => {
  const candidate = { ...baseCandidate(), source: "corpus" as const };
  const parsed = parseCandidate(formatCandidate(candidate));

  assertEquals(candidateSource(parsed), "corpus");
});

Deno.test("an entry written before source existed reads as generated", () => {
  // The store predates the field; the whole of it is generator output, so the
  // absent value has one honest reading.
  const { source: _source, ...withoutSource } = {
    ...baseCandidate(),
    source: undefined,
  };

  assertEquals(candidateSource(withoutSource), "generated");
});

Deno.test("stripVariant() takes a version back to the board it forked from", () => {
  assertEquals(stripVariant("erik-b"), "erik");
});

Deno.test("stripVariant() takes a later version back to the same board", () => {
  assertEquals(stripVariant("erik-c"), "erik");
});

Deno.test("stripVariant() leaves a board that was never forked alone", () => {
  assertEquals(stripVariant("erik"), "erik");
});

Deno.test("stripVariant() leaves a numeric name-collision suffix alone", () => {
  // `hans-2` is a different board whose name collided, not a second version of
  // `hans` — promoting it must not ship it as `hans`.
  assertEquals(stripVariant("hans-2"), "hans-2");
});

Deno.test("stripVariant() forks a name-collision board back to its own name", () => {
  assertEquals(stripVariant("hans-2-b"), "hans-2");
});

Deno.test("stripVariant() strips the name as it strips the slug", () => {
  assertEquals(stripVariant("Erik-b"), "Erik");
});

Deno.test("candidateLabel() shows a numbered board by its number", () => {
  assertEquals(
    candidateLabel({ slug: "candidate-12", name: "candidate-12" }),
    "12",
  );
});

Deno.test("candidateLabel() shows a numbered variant with its letter", () => {
  assertEquals(
    candidateLabel({ slug: "candidate-12-b", name: "candidate-12-b" }),
    "12 (b)",
  );
});

Deno.test("candidateLabel() shows a named board by its name", () => {
  assertEquals(candidateLabel({ slug: "erik-b", name: "Erik-b" }), "Erik-b");
});

Deno.test("nextCandidateNumber() starts at one in an empty store", () => {
  assertEquals(nextCandidateNumber([]), 1);
});

Deno.test("nextCandidateNumber() takes one past the highest, gaps and all", () => {
  assertEquals(
    nextCandidateNumber(["candidate-2", "candidate-7", "candidate-4"]),
    8,
  );
});

Deno.test("nextCandidateNumber() counts a numbered variant's base", () => {
  assertEquals(nextCandidateNumber(["candidate-3-b"]), 4);
});

Deno.test("nextCandidateNumber() ignores named boards", () => {
  assertEquals(nextCandidateNumber(["erik", "hans-2", "candidate-1"]), 2);
});

const member = (
  slug: string,
  createdAt: string,
  extra: Partial<Candidate> = {},
): Candidate => ({
  ...baseCandidate(),
  name: slug,
  slug,
  createdAt: new Date(createdAt),
  ...extra,
});

/** Erik iterated three times; Hans made once, after Erik's first version. */
const store = [
  member("erik-c", "2026-03-01", { rating: 3.5 }),
  member("hans", "2026-02-01", { rating: 3 }),
  member("erik", "2026-01-01", { rating: 2, promotedAs: "erik" }),
  member("erik-b", "2026-02-15", { rating: 4.5 }),
];

Deno.test("candidateFamilies() puts the family worked on most recently first", () => {
  assertEquals(
    candidateFamilies(store).map((family) => family.base),
    ["erik", "hans"],
  );
});

Deno.test("candidateFamilies() orders a family's versions base first", () => {
  assertEquals(
    candidateFamilies(store)[0].members.map((c) => c.slug),
    ["erik", "erik-b", "erik-c"],
  );
});

Deno.test("candidateFamilies() shows a family as its newest version", () => {
  assertEquals(candidateFamilies(store)[0].newest.slug, "erik-c");
});

Deno.test("candidateFamilies() shows the latest letter when versions share a date", () => {
  const families = candidateFamilies([
    member("ida-c", "2026-01-01"),
    member("ida", "2026-01-01"),
    member("ida-b", "2026-01-01"),
  ]);
  assertEquals(families[0].newest.slug, "ida-c");
});

Deno.test("candidateFamilies() takes the best rating across the family", () => {
  assertEquals(candidateFamilies(store)[0].bestRating, 4.5);
});

Deno.test("candidateFamilies() leaves an unrated family without a rating", () => {
  assertEquals(
    candidateFamilies([member("ida", "2026-01-01")])[0].bestRating,
    undefined,
  );
});

Deno.test("candidateFamilies() marks a family whose version shipped", () => {
  assertEquals(candidateFamilies(store)[0].promotedAs, "erik");
});

Deno.test("candidateFamilies() keeps a numbered board's versions together", () => {
  const families = candidateFamilies([
    member("candidate-12-b", "2026-02-01"),
    member("candidate-12", "2026-01-01"),
    member("candidate-1", "2026-01-15"),
  ]);
  assertEquals(
    families.map((family) => family.members.map((c) => c.slug)),
    [["candidate-12", "candidate-12-b"], ["candidate-1"]],
  );
});

Deno.test("candidateFamilies() keeps a name-collision board apart from its namesake", () => {
  const families = candidateFamilies([
    member("hans", "2026-01-01"),
    member("hans-2", "2026-02-01"),
    member("hans-2-b", "2026-03-01"),
  ]);
  assertEquals(
    families.map((family) => family.members.map((c) => c.slug)),
    [["hans-2", "hans-2-b"], ["hans"]],
  );
});

Deno.test("candidateFamilies() marks the most recent of two shipped versions", () => {
  const families = candidateFamilies([
    member("erik", "2026-01-01", { promotedAs: "erik" }),
    member("erik-b", "2026-02-01", { promotedAs: "luna" }),
  ]);
  assertEquals(families[0].promotedAs, "luna");
});

/** A shipped puzzle, plus a stored family that holds the `ida` slot. */
const takenSlugs = new Set(["anna", "ida"]);

Deno.test("promoteTarget() ships a board under its own free name", () => {
  assertEquals(
    promoteTarget(member("vilma", "2026-01-01", { name: "Vilma" }), {
      takenSlugs,
    }),
    { type: "name", name: "Vilma", slug: "vilma" },
  );
});

Deno.test("promoteTarget() ships a variant under its family's free name", () => {
  assertEquals(
    promoteTarget(member("vilma-c", "2026-01-01", { name: "Vilma-c" }), {
      takenSlugs,
    }),
    { type: "name", name: "Vilma", slug: "vilma" },
  );
});

Deno.test("promoteTarget() asks for a name for a variant of a shipped puzzle", () => {
  assertEquals(
    promoteTarget(member("anna-b", "2026-01-01", { name: "Anna-b" }), {
      takenSlugs,
    }),
    { type: "ask" },
  );
});

Deno.test("promoteTarget() asks for a name when a shipped puzzle holds it", () => {
  assertEquals(
    promoteTarget(member("anna", "2026-01-01", { name: "Anna" }), {
      takenSlugs,
    }),
    { type: "ask" },
  );
});

Deno.test("promoteTarget() asks for a name when another family holds it", () => {
  assertEquals(
    promoteTarget(member("ida", "2026-01-01", { name: "Ida" }), {
      takenSlugs,
    }),
    { type: "ask" },
  );
});

Deno.test("promoteTarget() ships a name-collision board under its own name", () => {
  assertEquals(
    promoteTarget(member("anna-2", "2026-01-01", { name: "Anna-2" }), {
      takenSlugs,
    }),
    { type: "name", name: "Anna-2", slug: "anna-2" },
  );
});

Deno.test("promoteTarget() asks for a name for a numbered board", () => {
  assertEquals(
    promoteTarget(member("candidate-12", "2026-01-01"), { takenSlugs }),
    { type: "ask" },
  );
});

Deno.test("promoteTarget() asks for a name for a numbered variant", () => {
  assertEquals(
    promoteTarget(member("candidate-12-b", "2026-01-01"), { takenSlugs }),
    { type: "ask" },
  );
});

Deno.test("promoteTarget() won't promote a corpus copy", () => {
  assertEquals(
    promoteTarget(member("anna", "2026-01-01", { source: "corpus" }), {
      takenSlugs,
    }),
    { type: "shipped" },
  );
});

const otherBoard = {
  ...baseCandidate().board,
  destination: { x: 6, y: 6 },
};

/** Vilma shipped from `vilma-c`; the base `vilma` holds a different board. */
const vilma = [
  member("vilma", "2026-01-01", { board: otherBoard }),
  member("vilma-b", "2026-02-01", { board: otherBoard }),
  member("vilma-c", "2026-03-01", { promotedAs: "vilma" }),
];

Deno.test("shippedFrom() finds the version that shipped, not the base at its slug", () => {
  const puzzle = { ...member("vilma", "2026-03-02"), board: vilma[2].board };
  assertEquals(shippedFrom(puzzle, vilma)?.slug, "vilma-c");
});

Deno.test("shippedFrom() ignores a promotion whose board was since replaced", () => {
  const puzzle = { ...member("vilma", "2026-03-02"), board: otherBoard };
  assertEquals(shippedFrom(puzzle, vilma), undefined);
});

Deno.test("shippedFrom() finds nothing for a puzzle made by hand", () => {
  assertEquals(shippedFrom(member("anna", "2026-01-01"), vilma), undefined);
});

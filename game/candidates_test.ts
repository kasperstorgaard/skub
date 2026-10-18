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
  shippedFrom,
  storedSolutionMoves,
  stripVariant,
  toStoredScoring,
} from "./candidates.ts";
import type { Metrics, ScoredBoard } from "#/game/scoring.ts";
import type { Board, Move } from "#/game/types.ts";

const board: Board = {
  holes: [],
  portals: [],
  destination: { x: 3, y: 3 },
  pieces: [
    { x: 1, y: 1, type: "puck" },
    { x: 5, y: 5, type: "blocker" },
  ],
  walls: [{ x: 2, y: 2, orientation: "vertical" }],
};

const candidate: Candidate = {
  name: "Erik",
  slug: "erik",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  difficulty: "medium",
  minMoves: 8,
  board,
  genOptions: {
    difficulty: "medium",
    wallsRange: [5, 15],
    blockersRange: [3, 5],
    wallSpread: "balanced",
    symmetry: 0.5,
  },
  generatorVersion: "0.5",
};

const metrics: Metrics = {
  setupRatio: 0.3,
  coverage: 0.31,
  deception: 0.32,
  reversals: 1,
  crossTrailOverlap: 2,
  totalDistance: 20,
  pieceUsage: 0.33,
  stopWeighted: 12,
  pointlessClearance: 0,
  sameDirectionRepeat: 0,
  openingSetup: 1,
  uniqueSolutions: 2,
  wallUtilization: 0.34,
  deadSpace: 0.35,
  puckPathVariety: 0.5,
  clumping: 0.36,
  emptyRegion: 0.37,
  wallSymmetry: 0.38,
  firstMovePrecision: 0.25,
  searchProfile: 0.39,
  isolationGap: 2,
  nearMissCount: 1,
};

const routeA: Move[] = [
  [{ x: 1, y: 1 }, { x: 1, y: 5 }],
  [{ x: 1, y: 5 }, { x: 4, y: 5 }],
];
const routeB: Move[] = [[{ x: 5, y: 5 }, { x: 5, y: 0 }]];

const scored: ScoredBoard = {
  score: 0.4123456,
  mean: 0.4123456,
  min: 0.3,
  stddev: 0.05,
  perSolution: [
    { moves: routeA, metrics, score: 0.3 },
    { moves: routeB, metrics, score: 0.5246913 },
  ],
};

Deno.test("formatCandidate → parseCandidate round-trips feedback + provenance", () => {
  const rated: Candidate = {
    ...candidate,
    rating: 2,
    reasons: ["clumped", "empty-areas"],
    note: "huddles in one corner",
  };

  assertEquals(parseCandidate(formatCandidate(rated)), rated);
});

Deno.test("an unrated candidate omits rating cleanly", () => {
  assertEquals(parseCandidate(formatCandidate(candidate)).rating, undefined);
});

Deno.test("a candidate's scoring survives the trip through markdown", () => {
  const analysed = { ...candidate, scoring: toStoredScoring(scored, metrics) };

  assertEquals(parseCandidate(formatCandidate(analysed)), analysed);
});

Deno.test("toStoredScoring() rounds scores for a readable diff", () => {
  const scoring = toStoredScoring(scored, metrics);

  assertEquals(
    { score: scoring.score, route: scoring.solutions[1].score },
    { score: 0.4123, route: 0.5247 },
  );
});

Deno.test("storedSolutionMoves() decodes the stored routes back to moves", () => {
  // The stored move encoding is the URL's.
  const scoring = toStoredScoring(scored, metrics);

  assertEquals(storedSolutionMoves(scoring), [routeA, routeB]);
});

Deno.test("per-route tags round-trip keyed by their moves", () => {
  const scoring = toStoredScoring(scored, metrics);
  const tagged: Candidate = {
    ...candidate,
    scoring,
    solutionTags: {
      [scoring.solutions[0].moves]: ["interesting", "unique"],
      [scoring.solutions[1].moves]: ["too-easy", "boring"],
    },
  };

  assertEquals(parseCandidate(formatCandidate(tagged)), tagged);
});

Deno.test("a candidate's source round-trips through markdown", () => {
  const copy: Candidate = { ...candidate, source: "corpus" };

  assertEquals(
    candidateSource(parseCandidate(formatCandidate(copy))),
    "corpus",
  );
});

Deno.test("an entry written before source existed reads as generated", () => {
  // The store predates the field; the whole of it is generator output, so the
  // absent value has one honest reading.
  assertEquals(candidateSource(candidate), "generated");
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
    "C-12",
  );
});

Deno.test("candidateLabel() shows a numbered variant with its letter", () => {
  assertEquals(
    candidateLabel({ slug: "candidate-12-b", name: "candidate-12-b" }),
    "C-12 (b)",
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

/** Erik iterated three times and shipped first; Hans made once in between. */
const store: Candidate[] = [
  {
    ...candidate,
    slug: "erik-c",
    createdAt: new Date("2026-03-01"),
    rating: 3.5,
  },
  { ...candidate, slug: "hans", createdAt: new Date("2026-02-01"), rating: 3 },
  { ...candidate, rating: 2, promotedAs: "erik" },
  {
    ...candidate,
    slug: "erik-b",
    createdAt: new Date("2026-02-15"),
    rating: 4.5,
  },
];

Deno.test("candidateFamilies() puts the family worked on most recently first", () => {
  const families = candidateFamilies(store);

  assertEquals(families.map((family) => family.base), ["erik", "hans"]);
});

Deno.test("candidateFamilies() orders a family's versions base first", () => {
  const [erik] = candidateFamilies(store);

  assertEquals(erik.members.map((c) => c.slug), ["erik", "erik-b", "erik-c"]);
});

Deno.test("candidateFamilies() sums a family up from all its versions", () => {
  const [erik] = candidateFamilies(store);

  assertEquals(
    {
      newest: erik.newest.slug,
      shown: erik.shown.slug,
      bestRating: erik.bestRating,
      promotedAs: erik.promotedAs,
    },
    { newest: "erik-c", shown: "erik", bestRating: 4.5, promotedAs: "erik" },
  );
});

Deno.test("candidateFamilies() shows the newest version when none shipped", () => {
  const [hans] = candidateFamilies([
    { ...candidate, slug: "hans" },
    { ...candidate, slug: "hans-b", createdAt: new Date("2026-02-01") },
  ]);

  assertEquals(hans.shown.slug, "hans-b");
});

Deno.test("candidateFamilies() shows the latest letter when versions share a date", () => {
  const [erik] = candidateFamilies([
    { ...candidate, slug: "erik-c" },
    candidate,
    { ...candidate, slug: "erik-b" },
  ]);

  assertEquals(erik.newest.slug, "erik-c");
});

Deno.test("candidateFamilies() leaves an unrated family without a rating", () => {
  assertEquals(candidateFamilies([candidate])[0].bestRating, undefined);
});

Deno.test("candidateFamilies() marks the most recent of two shipped versions", () => {
  const [erik] = candidateFamilies([
    { ...candidate, promotedAs: "erik" },
    {
      ...candidate,
      slug: "erik-b",
      createdAt: new Date("2026-02-01"),
      promotedAs: "luna",
    },
  ]);

  assertEquals(erik.promotedAs, "luna");
});

Deno.test("candidateFamilies() keeps a numbered board's versions together", () => {
  const families = candidateFamilies([
    { ...candidate, slug: "candidate-12-b", createdAt: new Date("2026-02-01") },
    { ...candidate, slug: "candidate-12" },
    { ...candidate, slug: "candidate-1", createdAt: new Date("2026-01-15") },
  ]);

  assertEquals(
    families.map((family) => family.members.map((c) => c.slug)),
    [["candidate-12", "candidate-12-b"], ["candidate-1"]],
  );
});

Deno.test("candidateFamilies() keeps a name-collision board apart from its namesake", () => {
  const families = candidateFamilies([
    { ...candidate, slug: "hans" },
    { ...candidate, slug: "hans-2", createdAt: new Date("2026-02-01") },
    { ...candidate, slug: "hans-2-b", createdAt: new Date("2026-03-01") },
  ]);

  assertEquals(
    families.map((family) => family.members.map((c) => c.slug)),
    [["hans-2", "hans-2-b"], ["hans"]],
  );
});

/** A shipped puzzle, plus a stored family that holds the `ida` slot. */
const takenSlugs = new Set(["anna", "ida"]);

Deno.test("promoteTarget() ships a board under its own free name", () => {
  assertEquals(promoteTarget(candidate, { takenSlugs }), {
    type: "name",
    name: "Erik",
    slug: "erik",
  });
});

Deno.test("promoteTarget() ships a variant under its family's free name", () => {
  const variant = { ...candidate, name: "Erik-c", slug: "erik-c" };

  assertEquals(promoteTarget(variant, { takenSlugs }), {
    type: "name",
    name: "Erik",
    slug: "erik",
  });
});

Deno.test("promoteTarget() asks for a name for a variant of a shipped puzzle", () => {
  const variant = { ...candidate, name: "Anna-b", slug: "anna-b" };

  assertEquals(promoteTarget(variant, { takenSlugs }), { type: "ask" });
});

Deno.test("promoteTarget() asks for a name when a shipped puzzle holds it", () => {
  const anna = { ...candidate, name: "Anna", slug: "anna" };

  assertEquals(promoteTarget(anna, { takenSlugs }), { type: "ask" });
});

Deno.test("promoteTarget() asks for a name when another family holds it", () => {
  const ida = { ...candidate, name: "Ida", slug: "ida" };

  assertEquals(promoteTarget(ida, { takenSlugs }), { type: "ask" });
});

Deno.test("promoteTarget() ships a name-collision board under its own name", () => {
  const collided = { ...candidate, name: "Anna-2", slug: "anna-2" };

  assertEquals(promoteTarget(collided, { takenSlugs }), {
    type: "name",
    name: "Anna-2",
    slug: "anna-2",
  });
});

Deno.test("promoteTarget() asks for a name for a numbered board", () => {
  const numbered = { ...candidate, name: "candidate-12", slug: "candidate-12" };

  assertEquals(promoteTarget(numbered, { takenSlugs }), { type: "ask" });
});

Deno.test("promoteTarget() asks for a name for a numbered variant", () => {
  const numbered = {
    ...candidate,
    name: "candidate-12-b",
    slug: "candidate-12-b",
  };

  assertEquals(promoteTarget(numbered, { takenSlugs }), { type: "ask" });
});

Deno.test("promoteTarget() won't promote a corpus copy", () => {
  const copy: Candidate = { ...candidate, source: "corpus" };

  assertEquals(promoteTarget(copy, { takenSlugs }), { type: "shipped" });
});

const otherBoard: Board = { ...board, destination: { x: 6, y: 6 } };

/** Erik shipped from `erik-c`; the base `erik` holds a different board. */
const erikFamily: Candidate[] = [
  { ...candidate, board: otherBoard },
  { ...candidate, slug: "erik-c", promotedAs: "erik" },
];

Deno.test("shippedFrom() finds the version that shipped, not the base at its slug", () => {
  assertEquals(shippedFrom(candidate, erikFamily)?.slug, "erik-c");
});

Deno.test("shippedFrom() ignores a promotion whose board was since replaced", () => {
  const replaced = { ...candidate, board: otherBoard };

  assertEquals(shippedFrom(replaced, erikFamily), undefined);
});

Deno.test("shippedFrom() finds nothing for a puzzle made by hand", () => {
  const handMade = { ...candidate, slug: "anna" };

  assertEquals(shippedFrom(handMade, erikFamily), undefined);
});

import { assertEquals } from "@std/assert/equals";

import {
  sameBoard,
  stripVariant,
  upsertCandidate,
  writeCandidate,
} from "./candidate-store.ts";
import type { Board, Puzzle } from "#/game/types.ts";

const board = (): Board => ({
  destination: { x: 3, y: 3 },
  pieces: [
    { x: 1, y: 1, type: "puck" },
    { x: 5, y: 5, type: "blocker" },
  ],
  walls: [
    { x: 2, y: 2, orientation: "vertical" },
    { x: 4, y: 6, orientation: "horizontal" },
  ],
});

Deno.test("sameBoard() ignores the order pieces and walls are listed in", () => {
  // A board that round-trips through the editor comes back reordered; that's
  // not a changed board, and treating it as one would re-solve on every visit.
  const reordered: Board = {
    ...board(),
    pieces: board().pieces.toReversed(),
    walls: board().walls.toReversed(),
  };

  assertEquals(sameBoard(board(), reordered), true);
});

Deno.test("sameBoard() separates boards that differ by one wall", () => {
  const extra: Board = {
    ...board(),
    walls: [...board().walls, { x: 6, y: 6, orientation: "vertical" }],
  };

  assertEquals(sameBoard(board(), extra), false);
});

Deno.test("sameBoard() separates boards that differ only in destination", () => {
  assertEquals(
    sameBoard(board(), { ...board(), destination: { x: 4, y: 3 } }),
    false,
  );
});

Deno.test("stripVariant() takes a version back to the board it forked from", () => {
  assertEquals(stripVariant("erik-b"), "erik");
  assertEquals(stripVariant("erik-c"), "erik");
  assertEquals(stripVariant("erik"), "erik");
});

Deno.test("stripVariant() leaves a numeric name-collision suffix alone", () => {
  // `hans-2` is a different board whose name collided, not a second version of
  // `hans` — promoting it must not ship it as `hans`.
  assertEquals(stripVariant("hans-2"), "hans-2");
  assertEquals(stripVariant("hans-2-b"), "hans-2");
});

Deno.test("stripVariant() strips the name as it strips the slug", () => {
  assertEquals(stripVariant("Erik-b"), "Erik");
});

/**
 * The store is a directory resolved against the working directory, so a temp
 * cwd is all it takes to keep a test off the real one.
 */
async function withTempStore(run: () => Promise<void>) {
  const cwd = Deno.cwd();
  const dir = await Deno.makeTempDir();
  Deno.chdir(dir);
  try {
    await run();
  } finally {
    Deno.chdir(cwd);
    await Deno.remove(dir, { recursive: true });
  }
}

/** Solves in one move: the puck slides down and the blocker stops it on target. */
const solvable = (): Puzzle => ({
  name: "Erik",
  slug: "erik",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  difficulty: "medium",
  minMoves: 1,
  board: {
    destination: { x: 0, y: 3 },
    pieces: [
      { x: 0, y: 0, type: "puck" },
      { x: 0, y: 4, type: "blocker" },
    ],
    walls: [],
  },
});

Deno.test("upsertCandidate() keeps what the entry owns when the board is unchanged", async () => {
  await withTempStore(async () => {
    const rated = await upsertCandidate(solvable(), "generated");
    await writeCandidate({
      ...rated,
      rating: 4,
      note: "worth keeping",
      solutionTags: { "a1a4": ["interesting"] },
      promotedAs: "erik",
    });

    // What `clone` hands the editor: the same board, identity stripped.
    const candidate = await upsertCandidate({
      ...solvable(),
      minMoves: 0,
      createdAt: new Date("2026-08-30T00:00:00.000Z"),
    });

    assertEquals(candidate.rating, 4);
    assertEquals(candidate.note, "worth keeping");
    assertEquals(candidate.solutionTags, { "a1a4": ["interesting"] });
    assertEquals(candidate.promotedAs, "erik");
    // The measured count survives a draft that zeroed it, and so does the date.
    assertEquals(candidate.minMoves, 1);
    assertEquals(candidate.createdAt.getTime(), Date.UTC(2026, 0, 1));
  });
});

Deno.test("upsertCandidate() re-analyses when the board moved under it", async () => {
  await withTempStore(async () => {
    await upsertCandidate(solvable(), "generated");

    // Drop the blocker one row: the puck now stops past the destination, so it
    // has to come back — a different board, and a different move count.
    const moved = solvable();
    moved.board.pieces[1] = { x: 0, y: 6, type: "blocker" };
    const candidate = await upsertCandidate(moved);

    assertEquals(candidate.minMoves > 1, true);
    // The stored analysis went with it rather than describing the old board.
    assertEquals(
      candidate.scoring?.solutions.every((s) => s.moves.length > 0),
      true,
    );
  });
});

Deno.test("upsertCandidate() takes a new entry's difficulty from the move count", async () => {
  await withTempStore(async () => {
    // A one-move board is easy whatever the draft claimed.
    const candidate = await upsertCandidate(
      { ...solvable(), difficulty: "ultra" },
      "generated",
    );

    assertEquals(candidate.difficulty, "easy");
  });
});

Deno.test("upsertCandidate() leaves a difficulty already on disk alone", async () => {
  await withTempStore(async () => {
    const stored = await upsertCandidate(solvable(), "generated");
    await writeCandidate({ ...stored, difficulty: "hard" });

    const candidate = await upsertCandidate(solvable());

    // Hand-set labels predate the move-based rule and are kept, not re-derived.
    assertEquals(candidate.difficulty, "hard");
  });
});

Deno.test("upsertCandidate() keeps the stored source when none is given", async () => {
  await withTempStore(async () => {
    await upsertCandidate(solvable(), "corpus");
    const candidate = await upsertCandidate(solvable());

    assertEquals(candidate.source, "corpus");
  });
});

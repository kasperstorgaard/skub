import { type Signal, useSignal } from "@preact/signals";
import { useCallback, useRef } from "preact/hooks";

import { useSolveStream } from "#/client/use-solve-stream.ts";
import { flipBoard, rollDice, rotateBoard } from "#/game/board.ts";
import {
  categorizeTile,
  composeDealt,
  type ComposerConfig,
  type DealtTile,
  extractQuadrant,
  flipTile,
  identifyTile,
  pickTiles,
  QUADRANT_ORIGINS,
  replaceQuadrant,
  rotateTile,
  toTile,
  turnPlacement,
  WHOLE_BOARD_ORDER,
} from "#/game/tiles.ts";
import type { Board, Puzzle, Rotation, TileEntry } from "#/game/types.ts";
import type { DiceThrows } from "#/lib/dice.ts";

type UseComposerOptions = {
  // The board being composed, in the shape the editor's components speak
  puzzle: Signal<Puzzle>;
  // What was dealt, so a tile can be turned or traded for one of its kind
  dealt: Signal<DealtTile[]>;
  // How to deal, and what a roll may come back with
  config: Signal<ComposerConfig>;
  // The tiles there are to deal from
  catalog: TileEntry[];
  // Where a roll leaves its throws, for the board to play out. Only the
  // sidebar rolls, so the board-side controls leave it out.
  dice?: Signal<DiceThrows | null>;
};

/** Enough re-rolls to find a board in range; past that the range is the problem. */
const MAX_ROLL_ATTEMPTS = 30;

/**
 * Hook for composing a board from tiles.
 *
 * Returns the actions the composer's two halves share: the sidebar generates,
 * the board's own controls arrange and roll.
 */
export function useComposer(
  { puzzle, dealt, config, catalog, dice }: UseComposerOptions,
) {
  const setBoard = useCallback((board: Board) => {
    puzzle.value = { ...puzzle.value, board, minMoves: 0 };
  }, [puzzle]);

  /**
   * Laying the board out again invalidates where the dice came down — a puck
   * can end up inside a wall it never had to cross — so arranging takes both
   * back off and the board returns to waiting for a roll.
   */
  const setArrangedBoard = useCallback((board: Board) => {
    setBoard({
      ...board,
      destination: undefined,
      pieces: board.pieces.filter((piece) => piece.type !== "puck"),
    });

    if (dice) dice.value = null;
  }, [dice, setBoard]);

  // What the last deal could not do, for the sidebar to show. Asking for a
  // pattern the catalog cannot cover is an ordinary thing to try.
  const dealError = useSignal<string | null>(null);

  const deal = useCallback(() => {
    let tiles;
    try {
      tiles = pickTiles(catalog, config.value);
    } catch (err) {
      dealError.value = err instanceof Error ? err.message : "Could not deal";
      return;
    }

    dealError.value = null;
    dealt.value = tiles;
    if (dice) dice.value = null;
    setBoard(composeDealt(tiles));
  }, [catalog, config, dealError, dealt, dice, setBoard]);

  // Keeps the tiles and re-lays them: new quadrants, new rotations.
  const shuffle = useCallback(() => {
    if (!dealt.value.length) return deal();

    const tiles = [...dealt.value]
      .sort(() => Math.random() - 0.5)
      .map((tile) => ({
        ...tile,
        rotation: Math.floor(Math.random() * 4) as Rotation,
      }));

    dealt.value = tiles;
    setArrangedBoard(composeDealt(tiles));
  }, [deal, dealt, setArrangedBoard]);

  const transform = useCallback(
    (index: number, turn: "rotate" | "flip") => {
      const origin = QUADRANT_ORIGINS[index];
      const tile = extractQuadrant(puzzle.value.board, origin);

      setArrangedBoard(replaceQuadrant(
        puzzle.value.board,
        turn === "rotate" ? rotateTile(tile, 1) : flipTile(tile),
        origin,
      ));

      dealt.value = dealt.value.map((placement, at) =>
        at === index ? turnPlacement(placement, turn) : placement
      );
    },
    [dealt, puzzle, setArrangedBoard],
  );

  // Brings in a different tile of the same kind, so the pattern still holds.
  const swap = useCallback((index: number) => {
    const origin = QUADRANT_ORIGINS[index];
    const standing = extractQuadrant(puzzle.value.board, origin);

    const options = catalog.filter((entry) =>
      entry.category === categorizeTile(standing)
    );
    if (!options.length) return;

    // Without the deal behind it — a reload, a draft picked back up — which
    // tile is standing here has to be read off the board, or every press
    // installs the same first option rather than moving along the list.
    const placement = dealt.value[index] ?? identifyTile(standing, catalog);

    const at = options.findIndex((entry) => entry.id === placement?.entry.id);

    const replacement: DealtTile = {
      entry: options[(at + 1) % options.length],
      rotation: placement?.rotation ?? 0,
      flipped: placement?.flipped ?? false,
    };

    // Nothing dealt means the board was built by hand; the swap still stands,
    // and the next press reads the replacement back off the board.
    if (dealt.value.length) {
      dealt.value = dealt.value.map((entry, spot) =>
        spot === index ? replacement : entry
      );
    }

    setArrangedBoard(
      replaceQuadrant(puzzle.value.board, toTile(replacement), origin),
    );
  }, [catalog, dealt, puzzle, setArrangedBoard]);

  const wholeBoard = useCallback((turn: "rotate" | "flip") => {
    setArrangedBoard(
      turn === "rotate"
        ? rotateBoard(puzzle.value.board, "right")
        : flipBoard(puzzle.value.board, "horizontal"),
    );

    // Every quadrant moves and every tile turns with it, so the record has to
    // be carried across rather than left describing the board from before.
    if (dealt.value.length) {
      dealt.value = WHOLE_BOARD_ORDER[turn].map((from) =>
        turnPlacement(dealt.value[from], turn)
      );
    }
  }, [dealt, puzzle, setArrangedBoard]);

  // A move range asks for re-rolls until one lands in it; without one, a roll is
  // a roll, and the difficulty badge solves it like any other edit.
  const attempts = useRef(0);
  const rollAgain = useRef<() => void>(() => {});

  const { start } = useSolveStream((event) => {
    const range = config.value.moves;
    if (!range || event.type === "progress") return;

    // A board that would not solve has no move count to judge — rolling again
    // is the answer, not scoring it as nothing and letting a range that starts
    // low take it.
    if (event.type === "solution") {
      const moves = event.moves.length;

      if (moves >= range[0] && moves <= range[1]) {
        puzzle.value = { ...puzzle.value, minMoves: moves };
        return;
      }
    }

    if (attempts.current++ < MAX_ROLL_ATTEMPTS) rollAgain.current();
  });

  const rollOnce = useCallback(() => {
    const board = puzzle.value.board;
    const { puck, destination } = rollDice(board);

    const rolled: Board = {
      ...board,
      destination: destination[destination.length - 1],
      pieces: [
        ...board.pieces.filter((piece) => piece.type === "blocker"),
        { ...puck[puck.length - 1], type: "puck" as const },
      ],
    };

    // The board takes where the dice came to rest; the throws that got them
    // there are the board's to play out.
    if (dice) {
      dice.value = { puck, destination, nonce: (dice.value?.nonce ?? 0) + 1 };
    }

    setBoard(rolled);
    if (config.value.moves) start(rolled);
  }, [config, dice, puzzle, setBoard, start]);

  rollAgain.current = rollOnce;

  const roll = useCallback(() => {
    attempts.current = 0;
    rollOnce();
  }, [rollOnce]);

  return { deal, dealError, shuffle, transform, swap, roll, wholeBoard };
}

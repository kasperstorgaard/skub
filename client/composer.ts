import { type Signal } from "@preact/signals";
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
  pickTiles,
  QUADRANT_ORIGINS,
  replaceQuadrant,
  rotateTile,
  toTile,
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

  const deal = useCallback(() => {
    const tiles = pickTiles(catalog, config.value);
    dealt.value = tiles;
    if (dice) dice.value = null;
    setBoard(composeDealt(tiles));
  }, [catalog, config, dealt, dice, setBoard]);

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
    setBoard(composeDealt(tiles));
  }, [deal, dealt, setBoard]);

  const transform = useCallback(
    (index: number, turn: "rotate" | "flip") => {
      const origin = QUADRANT_ORIGINS[index];
      const tile = extractQuadrant(puzzle.value.board, origin);

      setBoard(replaceQuadrant(
        puzzle.value.board,
        turn === "rotate" ? rotateTile(tile, 1) : flipTile(tile),
        origin,
      ));

      dealt.value = dealt.value.map((entry, at) =>
        at === index
          ? turn === "rotate"
            ? { ...entry, rotation: ((entry.rotation + 1) % 4) as Rotation }
            : { ...entry, flipped: !entry.flipped }
          : entry
      );
    },
    [dealt, puzzle, setBoard],
  );

  // Brings in a different tile of the same kind, so the pattern still holds.
  const swap = useCallback((index: number) => {
    const origin = QUADRANT_ORIGINS[index];
    const category = categorizeTile(
      extractQuadrant(puzzle.value.board, origin),
    );

    const options = catalog.filter((entry) => entry.category === category);
    if (!options.length) return;

    const at = options.findIndex((entry) =>
      entry.id === dealt.value[index]?.entry.id
    );

    const replacement: DealtTile = {
      entry: options[(at + 1) % options.length],
      rotation: dealt.value[index]?.rotation ?? 0,
      flipped: dealt.value[index]?.flipped ?? false,
    };

    // Nothing dealt means the board was built by hand; the swap still stands.
    if (dealt.value.length) {
      dealt.value = dealt.value.map((entry, spot) =>
        spot === index ? replacement : entry
      );
    }

    setBoard(replaceQuadrant(puzzle.value.board, toTile(replacement), origin));
  }, [catalog, dealt, puzzle, setBoard]);

  const wholeBoard = useCallback((turn: "rotate" | "flip") => {
    setBoard(
      turn === "rotate"
        ? rotateBoard(puzzle.value.board, "right")
        : flipBoard(puzzle.value.board, "horizontal"),
    );
  }, [puzzle, setBoard]);

  // A move range asks for re-rolls until one lands in it; without one, a roll is
  // a roll, and the difficulty badge solves it like any other edit.
  const attempts = useRef(0);
  const rollAgain = useRef<() => void>(() => {});

  const { start } = useSolveStream((event) => {
    const range = config.value.moves;
    if (!range || event.type === "progress") return;

    const moves = event.type === "solution" ? event.moves.length : 0;

    if (moves >= range[0] && moves <= range[1]) {
      puzzle.value = { ...puzzle.value, minMoves: moves };
      return;
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

  return { deal, shuffle, transform, swap, roll, wholeBoard };
}

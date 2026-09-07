import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { useSolveStream } from "#/client/use-solve-stream.ts";
import {
  ArrowClockwise,
  FlipHorizontal,
  Icon,
  Play,
  Repeat,
  Shuffle,
} from "#/components/icons.tsx";
import {
  flipBoard,
  rollPuckAndDestination,
  rotateBoard,
} from "#/game/board.ts";
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

type TileArrangerProps = {
  puzzle: Signal<Puzzle>;
  dealt: Signal<DealtTile[]>;
  config: Signal<ComposerConfig>;
  catalog: TileEntry[];
  className?: string;
};

const QUADRANT_NAMES = ["north-west", "north-east", "south-west", "south-east"];

/** Enough re-rolls to find a board in range; past that the range is the problem. */
const MAX_ROLL_ATTEMPTS = 30;

/**
 * The composer's board-side controls: deal four tiles, then arrange them.
 *
 * A tile is the unit of selection here rather than a cell — focus a quadrant and
 * rotate, mirror or swap it. Shift widens each action to the whole board, which
 * is a dihedral transform, so it never changes what the board is worth solving.
 */
export function TileArranger(
  { puzzle, dealt, config, catalog, className }: TileArrangerProps,
) {
  const [focused, setFocused] = useState<number | null>(null);

  const setBoard = useCallback((board: Puzzle["board"]) => {
    puzzle.value = { ...puzzle.value, board, minMoves: 0 };
  }, [puzzle]);

  const deal = useCallback(() => {
    const tiles = pickTiles(catalog, config.value);
    dealt.value = tiles;
    setBoard(composeDealt(tiles));
  }, [catalog, config, dealt, setBoard]);

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
    const current = extractQuadrant(puzzle.value.board, origin);
    const category = categorizeTile(current);

    const options = catalog.filter((entry) => entry.category === category);
    if (!options.length) return;

    const at = options.findIndex((entry) =>
      entry.id === dealt.value[index]?.entry.id
    );
    const next = options[(at + 1) % options.length];

    const replacement: DealtTile = {
      entry: next,
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

  // A range asks for re-rolls until one lands in it; without one, a roll is a
  // roll, and the difficulty badge solves it like any other edit.
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

  const roll = useCallback(() => {
    const board = puzzle.value.board;
    const { puck, destination } = rollPuckAndDestination(board);

    const rolled: Board = {
      ...board,
      destination,
      pieces: [
        ...board.pieces.filter((piece) => piece.type === "blocker"),
        { ...puck, type: "puck" as const },
      ],
    };

    setBoard(rolled);
    if (config.value.moves) start(rolled);
  }, [config, puzzle, setBoard, start]);

  rollAgain.current = roll;

  const wholeBoard = useCallback((turn: "rotate" | "flip") => {
    setBoard(
      turn === "rotate"
        ? rotateBoard(puzzle.value.board, "right")
        : flipBoard(puzzle.value.board, "horizontal"),
    );
  }, [puzzle, setBoard]);

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.isContentEditable || target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"
      ) return;

      const key = event.key.toLowerCase();
      if (!["r", "f", "s"].includes(key)) return;

      // Shift means the whole board rather than the tile in hand.
      if (event.shiftKey) {
        if (key === "s") return deal();
        return wholeBoard(key === "r" ? "rotate" : "flip");
      }

      if (key === "s") return shuffle();
      if (focused == null) return;

      return transform(focused, key === "r" ? "rotate" : "flip");
    };

    self.addEventListener("keyup", onKeyUp);
    return () => self.removeEventListener("keyup", onKeyUp);
  }, [deal, focused, shuffle, transform, wholeBoard]);

  return (
    <div className={clsx("flex flex-col gap-fl-1", className)}>
      <div className="grid grid-cols-2 gap-1 w-fit">
        {QUADRANT_NAMES.map((name, index) => (
          <button
            key={name}
            type="button"
            className={clsx(
              "size-8 border-2 rounded-1 bg-transparent",
              focused === index ? "border-brand" : "border-link",
            )}
            aria-label={`Tile ${
              dealt.value[index]?.entry.id ?? "quadrant"
            }, ${name}`}
            aria-pressed={focused === index}
            onClick={() => setFocused(focused === index ? null : index)}
          >
            <span className="sr-only">{name}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-fl-1 flex-wrap">
        <button
          type="button"
          className="icon-btn"
          data-size="sm"
          disabled={focused == null}
          onClick={() => focused != null && transform(focused, "rotate")}
        >
          <Icon icon={ArrowClockwise} />
          <span className="sr-only">Rotate tile</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          data-size="sm"
          disabled={focused == null}
          onClick={() => focused != null && transform(focused, "flip")}
        >
          <Icon icon={FlipHorizontal} />
          <span className="sr-only">Mirror tile</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          data-size="sm"
          disabled={focused == null}
          onClick={() => focused != null && swap(focused)}
        >
          <Icon icon={Repeat} />
          <span className="sr-only">Swap tile</span>
        </button>
      </div>

      <button type="button" className="btn" onClick={shuffle}>
        <Icon icon={Shuffle} /> Shuffle
      </button>

      <button
        type="button"
        className="btn"
        onClick={() => {
          attempts.current = 0;
          roll();
        }}
      >
        <Icon icon={Play} /> Roll
      </button>
    </div>
  );
}

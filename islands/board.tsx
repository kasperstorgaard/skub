import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useMemo, useRef } from "preact/hooks";

import { useRouter } from "./router.tsx";
import { useMoves } from "#/client/moves.ts";
import { calculateMoveSpeed } from "#/client/touch.ts";
import { Icon, X } from "#/components/icons.tsx";
import {
  getGrid,
  getTargets,
  isPositionSame,
  resolveMoves,
} from "#/game/board.ts";
import { getGuides, Guide } from "#/game/guides.ts";
import {
  type Direction,
  type Move,
  type Piece,
  Position,
  Puzzle,
  Wall,
} from "#/game/types.ts";
import {
  decodeState,
  getActiveHref,
  getMovesHref,
  getReplaySpeed,
} from "#/game/url.ts";
import { buildReplayKeyframes, type KeyframeStop } from "#/lib/replay.ts";

type BoardProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  mode: Signal<"editor" | "replay" | "solve" | "readonly">;
  className?: string;
};

export default function Board(
  { href, puzzle, mode, className }: BoardProps,
) {
  const swipeRegionRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const state = useMemo(() => decodeState(href.value), [href.value]);
  const moves = useMemo(
    () => state.moves.slice(0, state.cursor ?? state.moves.length),
    [
      state.moves,
      state.cursor,
    ],
  );

  const board = useMemo(() => resolveMoves(puzzle.value.board, moves), [
    puzzle.value.board,
    moves,
  ]);

  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, [board]);

  const { updateLocation } = useRouter({ onLocationUpdated });

  const spaces = useMemo(() => getGrid(), []);

  const guides = useMemo(
    () =>
      mode.value === "solve"
        ? getGuides(board, { active: state.active, hint: state.hint })
        : [],
    [state.active, state.hint, board, mode.value],
  );

  const activePiece = useMemo(() => {
    if (!state.active) return null;

    return board.pieces.find((piece) => isPositionSame(piece, state.active!));
  }, [state.active, puzzle.value.board.pieces]);

  const replaySpeed = useMemo(
    () => getReplaySpeed(href.value) ?? 1,
    [href.value],
  );

  const onMove = useCallback(
    (src: Position, opts: {
      direction: Direction;
      cellSize: number;
      velocity: number;
    }) => {
      if (!src || !boardRef.current) return;

      const possibleTargets = getTargets(src, {
        pieces: board.pieces,
        walls: board.walls,
      });

      const target = possibleTargets[opts.direction];
      let updatedHref = getActiveHref(src, { ...state, href: href.value });

      if (target) {
        const speed = calculateMoveSpeed(src, target, opts);
        boardRef.current.style.setProperty("--piece-speed", `${speed}ms`);

        updatedHref = getMovesHref([[src, target]], {
          ...state,
          href: updatedHref,
        });
      }

      updateLocation(updatedHref);
    },
    [state, href.value, mode.value],
  );

  /*
    Core move state for solve mode, including:
    - touch gestures
    - keyboard controls
  */
  useMoves(swipeRegionRef, boardRef, {
    pieces: board.pieces,
    active: state.active,
    onMove,
    isEnabled: mode.value === "solve",
  });

  return (
    <>
      <div
        ref={boardRef}
        // Reusable board style variables
        style={{
          "--active-bg": activePiece
            ? activePiece.type === "puck"
              ? "var(--color-ui-2)"
              : "var(--color-ui-3)"
            : null,
          "--hint-bg": "var(--color-ui-contrast)",
          "--replay-len": moves.length,
          "--gap": "var(--size-1)",
          // 39px
          "--space-w": "clamp(40px - var(--gap), 9.4666vw, 56px)",
          "--replay-speed": `${1 / replaySpeed}s`,
        }}
        className={clsx(
          // Relative for the touch region positioning
          "relative grid gap-(--gap) w-full grid-cols-[repeat(8,var(--space-w))] grid-rows-[repeat(8,var(--space-w))]",
          "print:[--space-w:62px]! print:[--gap:var(--size-2)]!",
          className,
        )}
      >
        {spaces.map((row) =>
          row.map((space) => (
            <BoardSpace
              {...space}
              isActive={Boolean(
                mode.value === "editor" && state.active &&
                  isPositionSame(state.active, space),
              )}
              href={mode.value === "editor"
                ? getActiveHref(space, { ...state, href: href.value })
                : undefined}
              data-router="replace"
            />
          ))
        )}

        <BoardDestination {...board.destination} />

        {board.walls.map((wall) => (
          <BoardWall
            key={`${wall.x}-${wall.y}-${wall.orientation}`}
            {...wall}
          />
        ))}

        {/* Move guides: target destinations + hint (if active) */}
        {guides.map((guide) => (
          <MoveGuide
            {...guide}
            href={getMovesHref([guide.move], {
              ...state,
              href: href.value,
            })}
          />
        ))}

        {board.pieces.map((piece, idx) => (
          <BoardPiece
            {...piece}
            href={getActiveHref(piece, { ...state, href: href.value })}
            id={getPieceId(piece, idx)}
            isActive={state.active && isPositionSame(piece, state.active)}
            isReadonly={mode.value === "replay" || mode.value === "editor"}
            onFocus={(event) => {
              const href = (event.target as HTMLAnchorElement).href;
              updateLocation(href, { replace: true });
            }}
          />
        ))}

        {mode.value === "replay" && (
          <BoardReplayStyles
            puzzle={puzzle.value}
            moves={moves}
          />
        )}

        {/* Swipe region for touch detection, hidden on non-coarse pointer devices */}
        {mode.value === "solve" && (
          <div
            ref={swipeRegionRef}
            className={clsx(
              "hidden pointer-coarse:block absolute -left-fl-4 -right-fl-4 -top-fl-4 -bottom-fl-4 z-1 touch-none",
            )}
          />
        )}
      </div>
    </>
  );
}

function BoardWall({ x, y, orientation }: Wall) {
  return (
    <div
      className={clsx(
        "place-self-start col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] w-full",
        "border-ui-4 aspect-square pointer-events-none",
        orientation === "vertical"
          ? "border-l-[3px] -ml-1"
          : "border-t-[3px] -mt-1",
      )}
      style={{
        "--x": x,
        "--y": y,
      }}
    />
  );
}

type BoardSpaceProps = Position & {
  isActive?: boolean;
  href?: string;
};

function BoardSpace({ x, y, href, isActive }: BoardSpaceProps) {
  if (href) {
    return (
      <a
        href={href}
        className={clsx(
          "grid col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] aspect-square rounded-1",
          "border-1 border-stone-9 border-b-1 border-r-1 border-r-stone-7 border-b-stone-7",
          isActive && "bg-brand/30 animate-blink",
        )}
        style={{
          "--x": x,
          "--y": y,
        }}
        data-router="replace"
      />
    );
  }

  return (
    <div
      className={clsx(
        "grid col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] aspect-square rounded-1",
        "border-1 border-stone-9 border-b-1 border-r-1 border-r-stone-7 border-b-stone-7",
      )}
      style={{
        "--x": x,
        "--y": y,
      }}
    />
  );
}

function BoardDestination({ x, y }: Position) {
  return (
    <div
      className={clsx(
        "col-[calc(var(--x)+1)] w-full row-[calc(var(--y)+1)]",
        "aspect-square flex items-center justify-center pointer-events-none",
        "border-2 border-ui-1",
      )}
      style={{
        "--x": x,
        "--y": y,
      }}
    >
      <Icon icon={X} className="text-ui-1 text-[calc(var(--space-w)-4px)]" />
    </div>
  );
}

type MoveGuideProps = Guide & {
  href: string;
};

function MoveGuide({ move, href, isHint }: MoveGuideProps) {
  const [active, target] = move;
  const isVertical = active.x === target.x;

  return (
    <>
      {/* Guide strip from active to target */}
      <div
        className={clsx(
          "bg-(--active-bg) opacity-20 pointer-events-none",
          isHint && "bg-(--hint-bg)/50 animate-blink",
        )}
        style={isVertical
          ? {
            gridColumnStart: `${active.x + 1}`,
            gridRowStart: `${Math.min(active.y, target.y) + 1}`,
            gridRowEnd: `${Math.max(active.y, target.y) + 2}`,
          }
          : {
            gridColumnStart: `${Math.min(active.x, target.x) + 1}`,
            gridColumnEnd: `${Math.max(active.x, target.x) + 2}`,
            gridRowStart: `${active.y + 1}`,
          }}
      />

      {/* Clickable target position */}
      <a
        href={href}
        className={clsx(
          "w-full aspect-square border-2 place-self-center col-[calc(var(--x)+1)] row-[calc(var(--y)+1)]",
          "border-(--active-bg)",
          isHint && "border-(--hint-bg) animate-blink",
        )}
        style={{
          "--x": target.x,
          "--y": target.y,
        }}
        aria-label={`move to ${target.x},${target.y}`}
        tabIndex={-1}
        data-router="replace"
      />
    </>
  );
}

type BoardPieceProps = {
  x: number;
  y: number;
  id: string;
  href: string;
  type: "puck" | "blocker";
  isActive?: boolean;
  isReadonly?: boolean;
  onFocus: (event: FocusEvent) => void;
};

function BoardPiece(
  { x, y, id, href, type, isReadonly, isActive, onFocus }: BoardPieceProps,
) {
  return (
    <a
      id={id}
      href={isReadonly ? "#" : href}
      style={{
        "--x": x,
        "--y": y,
        "--pad": "min(20%,var(--size-2))",
        // replay-{id} is generated by BoardReplayStyles based on moves list
        animation: `replay-${id} var(--replay-duration) ease-in-out`,
        "--replay-duration": "calc(var(--replay-len) * var(--replay-speed))",
      }}
      className={clsx(
        // position all pieces in the same grid spot, then translate them to their x/y position
        "grid col-start-1 row-start-1 w-full h-full p-(--pad) ",
        "translate-x-[calc((var(--space-w)+var(--gap))*var(--x))]",
        "translate-y-[calc((var(--space-w)+var(--gap))*var(--y))]",
        "transition-transform duration-(--piece-speed,200ms) ease-out",
        isReadonly && "pointer-events-none",
      )}
      tabIndex={isReadonly ? -1 : 0}
      onFocus={onFocus}
      aria-label={`${type} at ${x},${y}`}
      data-router={isReadonly ? undefined : "replace"}
      aria-current={isActive ? true : undefined}
    >
      <div
        className={clsx(
          "w-full h-full",
          type === "puck" && "bg-ui-2 rounded-round",
          type === "blocker" && "bg-ui-3 rounded-1",
        )}
      />
    </a>
  );
}

type BoardReplayProps = {
  puzzle: Puzzle;
  moves: Move[];
};

function BoardReplayStyles({ puzzle, moves }: BoardReplayProps) {
  if (!moves.length) return null;

  // Resolve each move to a keyframe stop with the piece's DOM id
  const stops: KeyframeStop[] = [];
  for (let idx = 0; idx < moves.length; idx++) {
    const move = moves[idx];
    const state = resolveMoves(puzzle.board, moves.slice(0, idx));
    const piece = state.pieces.find((item) => isPositionSame(item, move[0]));

    if (!piece) continue;

    const id = getPieceId(piece, state.pieces.indexOf(piece));
    stops.push({ id, from: move[0], to: move[1] });
  }

  return (
    <div data-e2e="replay-keyframes">
      <style>
        {buildReplayKeyframes(stops, moves.length)}
      </style>
    </div>
  );
}

function getPieceId(piece: Piece, idx: number) {
  return `${piece.type === "puck" ? "p" : "b"}_${idx}`;
}

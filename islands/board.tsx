import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { useRouter } from "./router.tsx";
import { useMoves } from "#/client/moves.ts";
import { calculateMoveSpeed } from "#/client/touch.ts";
import { Icon, X } from "#/components/icons.tsx";
import { PortalRings } from "#/components/portal-rings.tsx";
import {
  getGrid,
  getMoveSlide,
  getTargets,
  isPositionSame,
  isValidSolution,
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
import { getRippleDelay, TILE_DURATION_MS } from "#/lib/board-ripple.ts";
import {
  buildPortalKeyframes,
  buildPortalLoopKeyframes,
  buildReplayKeyframes,
  type KeyframeStop,
  loopDuration,
  loopName,
  type PortalLoop,
  type PortalWarp,
  warpDuration,
  warpName,
} from "#/lib/replay.ts";

type BoardProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  mode: Signal<"editor" | "replay" | "solve" | "readonly">;
  isNew?: boolean;
  className?: string;
};

export default function Board(
  { href, puzzle, mode, isNew = false, className }: BoardProps,
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

  const { pieces, dropped } = useMemo(
    () => trackPieces(puzzle.value.board, moves),
    [puzzle.value.board, moves],
  );

  const hasSolution = useMemo(
    () => mode.value === "solve" && isValidSolution(board),
    [board, mode.value],
  );

  // A portal loop leaves the piece circling with nowhere to come to rest, so
  // the board stops taking input until the move is undone.
  const loop = useMemo(
    () => getPortalLoop(puzzle.value.board, moves),
    [puzzle.value.board, moves],
  );

  const isLocked = loop != null;

  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, [board]);

  const { updateLocation } = useRouter({ onLocationUpdated });

  const spaces = useMemo(() => getGrid(), []);

  const guides = useMemo(
    () =>
      mode.value === "solve" && !isLocked
        ? getGuides(board, { active: state.active, hint: state.hint })
        : [],
    [state.active, state.hint, board, mode.value, isLocked],
  );

  const activePiece = useMemo(() => {
    if (!state.active) return null;

    return board.pieces.find((piece) => isPositionSame(piece, state.active!));
  }, [state.active, puzzle.value.board.pieces]);

  const replaySpeed = useMemo(
    () => getReplaySpeed(href.value) ?? 1,
    [href.value],
  );

  const [wiggle, setWiggle] = useState({ puck: isNew, blocker: isNew });

  // A hole removes the piece outright, so there is nothing left to animate.
  // Keep the one that just fell mounted for a beat and let it drop away.
  const [fall, setFall] = useState<FallingPiece | null>(null);
  const playedCount = useRef(moves.length);

  // Arriving on a URL that already holds the move should show the finished
  // board rather than replay it, so nothing animates on the very first render.
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  /**
   * Derived during the render that moves the piece, not in an effect. An effect
   * runs a render too late: the piece has already been given its final position
   * by then, and the plain transform transition has started dragging it
   * straight there — so the slide played twice, once wrongly.
   */
  const warp = useMemo(
    () => hasMounted.current ? getPortalWarp(puzzle.value.board, moves) : null,
    [moves, puzzle.value.board],
  );

  useEffect(() => {
    const isNewMove = moves.length > playedCount.current;
    playedCount.current = moves.length;

    if (isNewMove) setFall(getFallingPiece(puzzle.value.board, moves));
  }, [moves, puzzle.value.board]);

  const onMove = useCallback(
    (src: Position, opts: {
      direction: Direction;
      cellSize: number;
      velocity: number;
    }) => {
      if (!src || !boardRef.current) return;

      const target = getTargets(src, board)[opts.direction];
      let updatedHref = getActiveHref(src, { ...state, href: href.value });

      if (target) {
        const speed = calculateMoveSpeed(src, target, opts);
        boardRef.current.style.setProperty("--piece-speed", `${speed}ms`);

        updatedHref = getMovesHref([[src, target]], {
          ...state,
          href: updatedHref,
        });
      }

      updateLocation(updatedHref, { replace: true });
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
    isEnabled: mode.value === "solve" && !isLocked,
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
          "--tile-ripple-duration": `${TILE_DURATION_MS}ms`,
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
              destination={board.destination}
              hasSolution={hasSolution}
              href={mode.value === "editor"
                ? getActiveHref(space, { ...state, href: href.value })
                : undefined}
              data-router="replace"
            />
          ))
        )}

        {board.holes.map((hole) => (
          <BoardHole key={`hole-${hole.x}-${hole.y}`} {...hole} />
        ))}

        {board.portals.map((portal) => (
          <BoardPortal key={`portal-${portal.x}-${portal.y}`} {...portal} />
        ))}

        {mode.value === "editor" && state.active && (
          <BoardActiveCell {...state.active} />
        )}

        {board.destination && <BoardDestination {...board.destination} />}

        {board.walls.map((wall) => (
          <BoardWall
            key={`${wall.x}-${wall.y}-${wall.orientation}`}
            {...wall}
          />
        ))}

        {
          /* Move guides: target destinations + hint (if active).
            Hidden the moment a solve is detected — they shouldn't linger
            into the celebration cascade. */
        }
        {!hasSolution && guides.map((guide) => (
          <MoveGuide
            {...guide}
            href={getMovesHref([guide.move], {
              ...state,
              href: href.value,
            })}
          />
        ))}

        {pieces.map((piece) => (
          <BoardPiece
            key={piece.id}
            {...piece}
            href={getActiveHref(piece, { ...state, href: href.value })}
            warp={warp?.id === piece.id ? warp : undefined}
            loop={loop?.id === piece.id ? loop : undefined}
            isActive={state.active && isPositionSame(piece, state.active)}
            isReadonly={mode.value !== "solve" || isLocked}
            isReplay={mode.value === "replay"}
            wiggle={mode.value === "solve" && wiggle[piece.type]}
            onFocus={(event) => {
              const href = (event.target as HTMLAnchorElement).href;
              updateLocation(href, { replace: true });
              setWiggle((val) => ({ ...val, [piece.type]: false }));
            }}
          />
        ))}

        {
          /* Replay resolves the board to how it ends up, so a swallowed piece
            would otherwise be missing for the whole playback rather than seen
            to fall. Its keyframes hold it visible until the move that takes it. */
        }
        {mode.value === "replay" && dropped.map((piece) => (
          <BoardPiece
            key={piece.id}
            {...piece}
            href="#"
            isReadonly
            isReplay
            isDropped
            onFocus={() => {}}
          />
        ))}

        {warp && <style>{buildPortalKeyframes(warp)}</style>}

        {loop && <style>{buildPortalLoopKeyframes(loop)}</style>}

        {fall && (
          <BoardFallingPiece
            key={`fall-${fall.to.x}-${fall.to.y}-${moves.length}`}
            {...fall}
            onDone={() => setFall(null)}
          />
        )}

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
          ? "border-l-[3px] -ml-[3.5px]"
          : "border-t-[3px] -mt-[3.5px]",
      )}
      style={{
        "--x": x,
        "--y": y,
      }}
    />
  );
}

type BoardSpaceProps = Position & {
  href?: string;
  destination?: Position;
  hasSolution: boolean;
};

function BoardSpace(
  { x, y, href, destination, hasSolution }: BoardSpaceProps,
) {
  const tileStyle = {
    "--x": x,
    "--y": y,
    "--ripple-tx": destination ? Math.sign(x - destination.x) : 0,
    "--ripple-ty": destination ? Math.sign(y - destination.y) : 0,
    "--ripple-delay": hasSolution && destination
      ? `${getRippleDelay({ x, y }, destination)}ms`
      : undefined,
  };

  if (href) {
    return (
      <a
        href={href}
        className={clsx(
          "grid col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] aspect-square rounded-1",
          "border-1 border-stone-9 border-b-1 border-r-1 border-r-stone-7 border-b-stone-7",
          hasSolution && "tile-ripple",
        )}
        style={tileStyle}
        data-router="replace"
      />
    );
  }

  return (
    <div
      className={clsx(
        "grid col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] aspect-square rounded-1",
        "border-1 border-stone-9 border-b-1 border-r-1 border-r-stone-7 border-b-stone-7",
        hasSolution && "tile-ripple",
      )}
      style={tileStyle}
    />
  );
}

/**
 * The editor's selection tint, drawn as its own cell rather than on the space
 * beneath, because a hole or a portal fills its cell opaquely and would bury it.
 */
function BoardActiveCell({ x, y }: Position) {
  return (
    <div
      className={clsx(
        "col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] w-full aspect-square",
        // Positioned, because a portal's wrapper is — and a positioned sibling
        // paints above a non-positioned one whatever the document order, which
        // is what kept burying this.
        "relative rounded-1 bg-brand/30 animate-blink pointer-events-none",
      )}
      style={{ "--x": x, "--y": y }}
    />
  );
}

function BoardHole({ x, y }: Position) {
  return (
    <div
      className={clsx(
        "col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] w-full aspect-square",
        "rounded-1 bg-hole overflow-hidden pointer-events-none",
      )}
      style={{ "--x": x, "--y": y }}
    >
      {
        /* A fine hatch, so the void reads as a surface rather than a gap in the
          render — the only cue on themes whose ground is already black. */
      }
      <div
        className={clsx(
          "size-full opacity-8",
          "bg-[repeating-linear-gradient(45deg,#fff_0_1px,transparent_1px_5px)]",
        )}
      />
    </div>
  );
}

function BoardPortal({ x, y }: Position) {
  return (
    <div
      className={clsx(
        "col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] w-full aspect-square",
        "relative overflow-hidden rounded-1 pointer-events-none",
      )}
      style={{ "--x": x, "--y": y }}
    >
      <PortalRings />
    </div>
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

// `to` is the end of the slide's first leg, not where the piece comes to rest —
// a slide through a portal is drawn only as far as the portal it goes in by.
function MoveGuide({ move, to, href, isHint }: MoveGuideProps) {
  const [active] = move;
  const isVertical = active.x === to.x;

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
            gridRowStart: `${Math.min(active.y, to.y) + 1}`,
            gridRowEnd: `${Math.max(active.y, to.y) + 2}`,
          }
          : {
            gridColumnStart: `${Math.min(active.x, to.x) + 1}`,
            gridColumnEnd: `${Math.max(active.x, to.x) + 2}`,
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
          "--x": to.x,
          "--y": to.y,
        }}
        aria-label={`move to ${to.x},${to.y}`}
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
  isReplay?: boolean;
  isDropped?: boolean;
  warp?: PortalWarp;
  loop?: PortalLoop;
  wiggle?: boolean;
  onFocus: (event: FocusEvent) => void;
};

function BoardPiece(
  {
    x,
    y,
    id,
    href,
    type,
    isReadonly,
    isReplay,
    isDropped,
    isActive,
    warp,
    loop,
    wiggle,
    onFocus,
  }: BoardPieceProps,
) {
  return (
    <a
      id={id}
      href={isReadonly ? "#" : href}
      style={{
        "--x": x,
        "--y": y,
        "--pad": "min(20%,var(--size-2))",
        // replay-{id} keyframes are generated by BoardReplayStyles, only mounted
        // in replay mode. Setting the inline animation outside that mode would
        // shadow the board exit animation (inline > stylesheet specificity).
        //
        // `both` holds the piece at its opening keyframe until the replay
        // reaches it. Without it the element paints once at the position the
        // board resolves to — where the piece ends up — and twitches back to
        // the start as the animation takes over.
        animation: isReplay
          ? `replay-${id} var(--replay-duration) ease-in-out both`
          // A slide through a portal is not a straight line, so it animates on
          // generated keyframes rather than the plain transform transition,
          // which would cut straight across the board.
          : warp
          ? `${warpName(warp)} ${warpDuration(warp)}ms linear`
          // Caught between two portals: it circles until the move is undone.
          : loop
          ? `${loopName(loop.id)} ${loopDuration(loop)}ms linear infinite`
          : undefined,
        "--replay-duration": "calc(var(--replay-len) * var(--replay-speed))",
      }}
      className={clsx(
        // position all pieces in the same grid spot, then translate them to their x/y position
        "grid col-start-1 row-start-1 w-full h-full p-(--pad)",
        "translate-x-[calc((var(--space-w)+var(--gap))*var(--x))]",
        "translate-y-[calc((var(--space-w)+var(--gap))*var(--y))]",
        // A keyframed piece drives --x/--y itself, so the transition would only
        // smear the steps it is trying to make crisp.
        !warp && !loop && !isReplay &&
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
        style={{
          animation: isDropped
            ? `replay-${id}-drop var(--replay-duration) ease-in-out both`
            : warp
            ? `${warpName(warp)}-squish ${warpDuration(warp)}ms linear`
            : loop
            ? `${loopName(loop.id)}-squish ${
              loopDuration(loop)
            }ms linear infinite`
            : undefined,
        }}
        className={clsx(
          "w-full h-full",
          type === "puck" && "bg-ui-2 rounded-round",
          type === "blocker" && "bg-ui-3 rounded-1",
          wiggle && type === "puck" && "pulse-puck",
          wiggle && type === "blocker" && "jiggle",
        )}
      />
    </a>
  );
}

type FallingPiece = {
  type: Piece["type"];
  from: Position;
  to: Position;
};

/** The piece the last move dropped in a hole, if it dropped one. */
function getFallingPiece(
  board: Puzzle["board"],
  moves: Move[],
): FallingPiece | null {
  const lastMove = moves.at(-1);
  if (!lastMove) return null;

  const before = resolveMoves(board, moves.slice(0, -1));
  const slide = getMoveSlide(lastMove, before);
  if (slide?.outcome !== "dropped") return null;

  const piece = before.pieces.find((item) => isPositionSame(item, lastMove[0]));
  if (!piece) return null;

  // Start from the last leg, so a piece that fell after a portal drops from
  // where it came out rather than cutting across the board.
  const lastLeg = slide.segments[slide.segments.length - 1];

  return { type: piece.type, from: lastLeg[0], to: slide.target };
}

/**
 * The circuit a piece is stuck on, if the last move ended in a portal loop.
 *
 * Derived from the move list rather than stored, so a reloaded or shared link
 * arrives at the same locked board.
 */
function getPortalLoop(
  board: Puzzle["board"],
  moves: Move[],
): PortalLoop | null {
  const lastMove = moves.at(-1);
  if (!lastMove) return null;

  const { pieces } = trackPieces(board, moves.slice(0, -1));
  const slide = getMoveSlide(lastMove, { ...board, pieces });
  if (slide?.outcome !== "looped") return null;

  const piece = pieces.find((item) => isPositionSame(item, lastMove[0]));
  if (!piece) return null;

  // The last leg runs from the portal it came out of back into the one it
  // went in by — the circuit it now repeats.
  return { id: piece.id, leg: slide.segments[slide.segments.length - 1] };
}

/** The slide the last move took through a portal, if it took one. */
function getPortalWarp(
  board: Puzzle["board"],
  moves: Move[],
): PortalWarp | null {
  const lastMove = moves.at(-1);
  if (!lastMove) return null;

  const { pieces } = trackPieces(board, moves.slice(0, -1));
  const slide = getMoveSlide(lastMove, { ...board, pieces });

  // Only an ordinary slide that happens to pass through a portal warps. One leg
  // means it never reached one; a dropped piece is the falling ghost's job; and
  // a loop has no end to travel to, so it circles on getPortalLoop's animation
  // instead — which this would otherwise mask, being picked first.
  if (!slide || slide.segments.length < 2) return null;
  if (slide.outcome !== "stopped") return null;

  const piece = pieces.find((item) => isPositionSame(item, lastMove[0]));
  if (!piece) return null;

  return { id: piece.id, legs: slide.segments, nonce: moves.length };
}

type BoardFallingPieceProps = FallingPiece & {
  onDone: () => void;
};

/**
 * A piece on its way into a hole: it slides the last leg like any other move,
 * then the inner shape scales away once it has arrived. Mounting at `from` and
 * moving on the next frame is what gives the transition something to animate.
 */
function BoardFallingPiece(
  { type, from, to, onDone }: BoardFallingPieceProps,
) {
  const [at, setAt] = useState(from);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAt(to));
    return () => cancelAnimationFrame(frame);
  }, [to]);

  return (
    <div
      style={{
        "--x": at.x,
        "--y": at.y,
        "--pad": "min(20%,var(--size-2))",
      }}
      className={clsx(
        "grid col-start-1 row-start-1 w-full h-full p-(--pad) pointer-events-none",
        "translate-x-[calc((var(--space-w)+var(--gap))*var(--x))]",
        "translate-y-[calc((var(--space-w)+var(--gap))*var(--y))]",
        "transition-transform duration-(--piece-speed,200ms) ease-out",
      )}
    >
      <div
        onTransitionEnd={onDone}
        className={clsx(
          "w-full h-full origin-center",
          type === "puck" && "bg-ui-2 rounded-round",
          type === "blocker" && "bg-ui-3 rounded-1",
          "transition-all ease-in duration-300 delay-(--piece-speed,200ms)",
          at === from ? "scale-100 opacity-100" : "scale-0 opacity-0",
        )}
      />
    </div>
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
    const { pieces } = trackPieces(puzzle.board, moves.slice(0, idx));
    const piece = pieces.find((item) => isPositionSame(item, move[0]));
    const slide = getMoveSlide(move, { ...puzzle.board, pieces });

    if (!piece || !slide) continue;

    stops.push({
      id: piece.id,
      legs: slide.segments,
      dropped: slide.outcome === "dropped",
    });
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

type TrackedPiece = Piece & { id: string };

type TrackedBoard = {
  pieces: TrackedPiece[];
  /** The pieces a hole swallowed, each at the cell it fell into. */
  dropped: TrackedPiece[];
};

/**
 * Resolves the board while keeping hold of which piece is which, pinned to
 * where each one started, and of the ones that left along the way.
 *
 * Array position cannot serve as identity now that a hole can remove a piece:
 * every later slot shifts up, and a renderer keying on position would hand one
 * piece's element to another and animate the wrong one.
 */
function trackPieces(board: Puzzle["board"], moves: Move[]): TrackedBoard {
  let pieces: TrackedPiece[] = board.pieces.map((piece, idx) => ({
    ...piece,
    id: getPieceId(piece, idx),
  }));
  const dropped: TrackedPiece[] = [];

  for (const move of moves) {
    const slide = getMoveSlide(move, { ...board, pieces });
    if (!slide) break;

    if (slide.outcome === "dropped") {
      const piece = pieces.find((item) => isPositionSame(item, move[0]));
      if (piece) dropped.push({ ...piece, ...slide.target });

      pieces = pieces.filter((item) => !isPositionSame(item, move[0]));
      continue;
    }

    pieces = pieces.map((piece) =>
      isPositionSame(piece, move[0]) ? { ...piece, ...move[1] } : piece
    );
  }

  return { pieces, dropped };
}

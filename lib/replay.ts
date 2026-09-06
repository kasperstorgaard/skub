import type { Position } from "#/game/types.ts";

export type KeyframeStop = {
  id: string;
  /** Set when this move is the one a hole swallows the piece on. */
  dropped?: boolean;
  /**
   * The legs of the slide, each listing the cells it crosses. A slide has more
   * than one only when it passes through a portal, and the keyframes have to
   * jump between them rather than glide across the board.
   */
  legs: Position[][];
};

// A teleport lands on the frame it leaves, so the arriving keyframe sits a hair
// after the departing one rather than on the same percentage.
const TELEPORT_GAP = 0.01;

function writeKeyframeMove(percentage: number, position: Position) {
  return `${percentage}% { --x: ${position.x}; --y: ${position.y}; }`;
}

function legEnds(leg: Position[]): [Position, Position] {
  return [leg[0], leg[leg.length - 1]];
}

/** Writes one slide across a window, splitting it evenly between the legs. */
function writeStop(stop: KeyframeStop, start: number, end: number): string[] {
  const share = (end - start) / stop.legs.length;

  return stop.legs.flatMap((leg, index) => {
    const [from, to] = legEnds(leg);
    const legStart = start + index * share;

    return [
      writeKeyframeMove(index === 0 ? legStart : legStart + TELEPORT_GAP, from),
      writeKeyframeMove(legStart + share, to),
    ];
  });
}

/**
 * Builds CSS @keyframes text for a set of replay moves.
 * Each stop maps a piece id to the slide it travels.
 * Stops are evenly distributed across the animation timeline.
 */
export function buildReplayKeyframes(
  stops: KeyframeStop[],
  totalMoves: number,
): string {
  // wait is roughly half a move duration; increment covers only the actual moves.
  const initialWait = 0.4;
  const increment = 100 / (totalMoves + initialWait);
  const waitOffset = initialWait * increment;

  // Group stops by piece id
  const lookup: Record<string, { idx: number; stop: KeyframeStop }[]> = {};

  for (let idx = 0; idx < stops.length; idx++) {
    const stop = stops[idx];
    if (!lookup[stop.id]) lookup[stop.id] = [{ idx, stop }];
    else lookup[stop.id].push({ idx, stop });
  }

  const windowOf = (idx: number): [number, number] => [
    idx * increment + waitOffset,
    (idx + 1) * increment + waitOffset,
  ];

  return Object.entries(lookup)
    .map(([id, pieceStops]) => {
      const drop = pieceStops.find(({ stop }) => stop.dropped);

      return [
        `@keyframes replay-${id} {`,
        `  ${writeKeyframeMove(0, pieceStops[0].stop.legs[0][0])}`,
        /*
         * Each stop sets its start position just before animating, so a move
         * happens as a single step rather than a glide from the board's origin.
         */
        ...pieceStops.flatMap(({ idx, stop }) =>
          writeStop(stop, ...windowOf(idx)).map((frame) => `  ${frame}`)
        ),
        "}",
        // A swallowed piece is already gone from the board the replay resolves
        // to, so it needs its own reason to disappear at the right moment
        // rather than being missing for the whole playback.
        ...(drop ? [writeDrop(id, ...windowOf(drop.idx))] : []),
      ].join("");
    })
    .join("");
}

/** Shrinks a piece into the hole over the tail of the move that drops it. */
function writeDrop(id: string, start: number, end: number): string {
  return [
    `@keyframes replay-${id}-drop {`,
    "  0% { scale: 1 1; }",
    `  ${start + (end - start) * 0.7}% { scale: 1 1; }`,
    `  ${end}% { scale: 0 0; }`,
    "  100% { scale: 0 0; }",
    "}",
  ].join("");
}

/**
 * How long each leg of a portal slide travels, in ms — the same as the default
 * --piece-speed, so a leg moves at the pace of any other slide.
 */
export const PORTAL_TRAVEL_MS = 200;
/** How long the piece is gone for, between going in one portal and out the other. */
export const PORTAL_PAUSE_MS = 400;

export type PortalWarp = {
  id: string;
  legs: Position[][];
  /** Distinguishes one warp from the next, so a repeat move restarts. */
  nonce: number;
};

export function warpName({ id, nonce }: PortalWarp) {
  return `warp-${id}-${nonce}`;
}

export function warpDuration({ legs }: PortalWarp) {
  return PORTAL_TRAVEL_MS * legs.length +
    PORTAL_PAUSE_MS * (legs.length - 1);
}

/**
 * Keyframes for a slide that goes through a portal: travel in, vanish for the
 * length of the pause, then reappear at the far portal and travel on.
 *
 * A pair of portals can only ever bend a slide once, so there are exactly two
 * legs. The piece scales to nothing while it is between them — during the pause
 * it is not on the board at all, which is the whole point of a portal.
 *
 * Position and scale animate as two separate rules because the piece's
 * translate is composed from --x/--y on its outer element; a keyframe setting
 * `transform` there would replace it. The inner shape carries the scale.
 *
 * The animation itself runs linear so the pause keeps its length, and each
 * travelling leg sets its own ease-out to match an ordinary move.
 */
export function buildPortalKeyframes(warp: PortalWarp): string {
  const name = warpName(warp);
  const total = warpDuration(warp);
  const percent = (ms: number) => (ms / total) * 100;

  // In at the end of the first leg, out at the start of the last.
  const swallowed = percent(PORTAL_TRAVEL_MS);
  const emerges = percent(PORTAL_TRAVEL_MS + PORTAL_PAUSE_MS);
  // Position jumps midway through the pause, where nothing can be seen anyway.
  const jump = percent(PORTAL_TRAVEL_MS + PORTAL_PAUSE_MS / 2);

  const [start, entry] = legEnds(warp.legs[0]);
  const [exit, end] = legEnds(warp.legs[warp.legs.length - 1]);

  // Narrows going in and comes back out the same way, so the piece reads as
  // being drawn through rather than simply hidden.
  const pinch = swallowed * 0.85;
  const spread = emerges + (100 - emerges) * 0.3;
  const settled = emerges + (100 - emerges) * 0.6;

  return [
    `@keyframes ${name} {`,
    `0% { --x: ${start.x}; --y: ${start.y}; animation-timing-function: ease-out; }`,
    writeKeyframeMove(swallowed, entry),
    writeKeyframeMove(jump, entry),
    writeKeyframeMove(jump + TELEPORT_GAP, exit),
    `${emerges}% { --x: ${exit.x}; --y: ${exit.y}; animation-timing-function: ease-out; }`,
    writeKeyframeMove(100, end),
    "}",
    `@keyframes ${name}-squish {`,
    "0% { scale: 1 1; }",
    `${pinch}% { scale: 0.8 1; }`,
    `${swallowed}% { scale: 0 0.6; }`,
    `${emerges}% { scale: 0 0.6; }`,
    `${spread}% { scale: 0.8 1; }`,
    `${settled}% { scale: 1 0.8; }`,
    "100% { scale: 1 1; }",
    "}",
  ].join("");
}

export type PortalLoop = {
  id: string;
  /** The cells the piece circles, from the portal it comes out of to the one it goes back in. */
  leg: Position[];
};

/** How long the piece takes to cross one cell of the loop, in ms. */
const LOOP_MS_PER_CELL = 220;

export function loopName(id: string) {
  return `loop-${id}`;
}

export function loopDuration({ leg }: PortalLoop) {
  return Math.max(leg.length - 1, 1) * LOOP_MS_PER_CELL;
}

/**
 * Keyframes for a piece caught circling between two portals: it pops out of one,
 * slides across, and is swallowed by the other, forever.
 *
 * The jump back is the loop itself — 100% holds at the portal it goes into and
 * 0% is the one it comes out of, so wrapping round is the teleport.
 */
export function buildPortalLoopKeyframes(loop: PortalLoop): string {
  const name = loopName(loop.id);
  const [exit, entry] = [loop.leg[0], loop.leg[loop.leg.length - 1]];

  return [
    `@keyframes ${name} {`,
    writeKeyframeMove(0, exit),
    writeKeyframeMove(85, entry),
    writeKeyframeMove(100, entry),
    "}",
    `@keyframes ${name}-squish {`,
    "0% { scale: 0 0.6; }",
    "15% { scale: 1 1; }",
    "85% { scale: 1 1; }",
    "100% { scale: 0 0.6; }",
    "}",
  ].join("");
}

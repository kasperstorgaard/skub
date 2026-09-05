import type { Position } from "#/game/types.ts";

export type KeyframeStop = {
  id: string;
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

  return Object.entries(lookup)
    .map(([id, pieceStops]) => {
      return [
        `@keyframes replay-${id} {`,
        `  ${writeKeyframeMove(0, pieceStops[0].stop.legs[0][0])}`,
        /*
         * Each stop sets its start position just before animating, so a move
         * happens as a single step rather than a glide from the board's origin.
         */
        ...pieceStops.flatMap(({ idx, stop }) =>
          writeStop(
            stop,
            idx * increment + waitOffset,
            (idx + 1) * increment + waitOffset,
          ).map((frame) => `  ${frame}`)
        ),
        "}",
      ].join("");
    })
    .join("");
}

/** How long a piece is held in the portal, being pulled through, in ms. */
export const PORTAL_SQUISH_MS = 100;
/** How long the travel either side of a portal takes in total, in ms. */
export const PORTAL_TRAVEL_MS = 200;

export type PortalWarp = {
  id: string;
  legs: Position[][];
  /** Distinguishes one warp from the next, so a repeat move restarts. */
  nonce: number;
};

export function warpName({ id, nonce }: PortalWarp) {
  return `warp-${id}-${nonce}`;
}

export function warpDuration() {
  return PORTAL_TRAVEL_MS + PORTAL_SQUISH_MS;
}

/**
 * Keyframes for a slide that goes through a portal: travel in, a squish while
 * the piece is pulled through, then travel on.
 *
 * Position and scale animate as two separate rules because the piece's
 * translate is composed from --x/--y on its outer element — a keyframe setting
 * `transform` there would replace it. The inner shape carries the squish.
 *
 * The travel time is split between the legs by how far each one runs, so a long
 * approach and a short exit look like one continuous slide.
 */
export function buildPortalKeyframes(warp: PortalWarp): string {
  const name = warpName(warp);
  const total = warpDuration();

  const lengths = warp.legs.map((leg) => Math.max(leg.length - 1, 1));
  const travelled = lengths.reduce((sum, length) => sum + length, 0);

  const percent = (ms: number) => (ms / total) * 100;
  const first = PORTAL_TRAVEL_MS * (lengths[0] / travelled);

  // Enters the portal, is held there through the squish, leaves from the other.
  const arrive = percent(first);
  const midway = percent(first + PORTAL_SQUISH_MS / 2);
  const depart = percent(first + PORTAL_SQUISH_MS);
  // The shape springs back over the first part of the outward leg.
  const settled = depart + (100 - depart) * 0.35;

  const [firstLeg, lastLeg] = [warp.legs[0], warp.legs[warp.legs.length - 1]];
  const [start, entry] = legEnds(firstLeg);
  const [exit, end] = legEnds(lastLeg);

  return [
    `@keyframes ${name} {`,
    writeKeyframeMove(0, start),
    writeKeyframeMove(arrive, entry),
    writeKeyframeMove(midway, entry),
    writeKeyframeMove(midway + TELEPORT_GAP, exit),
    writeKeyframeMove(depart, exit),
    writeKeyframeMove(100, end),
    "}",
    `@keyframes ${name}-squish {`,
    `${arrive}% { scale: 1 1; }`,
    // Narrows going in, then flattens coming out; between the two it passes
    // through both at once, which is what sells being pulled through.
    `${midway}% { scale: 0.8 1; }`,
    `${depart}% { scale: 1 0.8; }`,
    `${settled}% { scale: 1 1; }`,
    "}",
  ].join("");
}

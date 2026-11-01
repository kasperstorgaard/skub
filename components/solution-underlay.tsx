import { clsx } from "clsx/lite";

import { getSolutionStops, type SolutionStep } from "#/game/solution-path.ts";
import type { Piece, Position } from "#/game/types.ts";

/** One dash and one gap, in px: how far the line flows per cycle. */
const DASH_PERIOD = 14;

type SolutionProps = {
  steps: SolutionStep[];
};

/**
 * A solution laid on the board's own grid, under the pieces: a line flowing
 * along each leg in its piece's colour, joined by a dot on every stop.
 */
export function SolutionUnderlay({ steps }: SolutionProps) {
  return (
    <>
      <style>
        {`@keyframes solution-flow { to { stroke-dashoffset: -${DASH_PERIOD}px; } }`}
      </style>

      {steps.flatMap((step, stepIndex) =>
        step.segments
          .filter((leg) => leg.length > 1)
          .map((leg, legIndex) => (
            <SolutionLine
              key={`${stepIndex}-${legIndex}`}
              leg={leg}
              piece={step.piece}
            />
          ))
      )}

      {getSolutionStops(steps).map((stop) => (
        <SolutionDot key={`${stop.x}-${stop.y}`} {...stop} />
      ))}
    </>
  );
}

/** Each stop's move numbers. Above the pieces, so a move back stays readable. */
export function SolutionNumbers({ steps }: SolutionProps) {
  return getSolutionStops(steps).map(({ x, y, moves }) => (
    <span
      key={`${x}-${y}`}
      className={clsx(
        "relative col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] place-self-start justify-self-end",
        "px-0.5 py-px rounded-1 pointer-events-none",
        "bg-gray-12 text-0 leading-none text-gray-1",
      )}
      style={{ "--x": x, "--y": y }}
    >
      {moves.join(",")}
    </span>
  ));
}

type SolutionLineProps = {
  leg: Position[];
  piece: Piece["type"];
};

/**
 * Spans the leg's cells, inset half a cell at each end to run centre to centre.
 * The percentages put it on the real grid whatever size the cells are.
 */
function SolutionLine({ leg, piece }: SolutionLineProps) {
  const from = leg[0];
  const to = leg[leg.length - 1];

  const isVertical = from.x === to.x;
  const isReversed = to.x < from.x || to.y < from.y;
  const [start, end] = isReversed ? ["100%", "0"] : ["0", "100%"];

  return (
    <div
      className={clsx(
        "relative pointer-events-none",
        isVertical
          ? "py-[calc(var(--space-w)/2)]"
          : "px-[calc(var(--space-w)/2)]",
      )}
      style={{
        gridColumnStart: `${Math.min(from.x, to.x) + 1}`,
        gridColumnEnd: `${Math.max(from.x, to.x) + 2}`,
        gridRowStart: `${Math.min(from.y, to.y) + 1}`,
        gridRowEnd: `${Math.max(from.y, to.y) + 2}`,
      }}
    >
      <svg className="block size-full overflow-visible" aria-hidden="true">
        <line
          x1={isVertical ? "50%" : start}
          y1={isVertical ? start : "50%"}
          x2={isVertical ? "50%" : end}
          y2={isVertical ? end : "50%"}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${DASH_PERIOD / 2} ${DASH_PERIOD / 2}`}
          className={clsx(
            "animate-[solution-flow_700ms_linear_infinite]",
            "motion-reduce:animate-none",
            "opacity-80",
            piece === "puck" ? "text-ui-2" : "text-ui-3",
          )}
        />
      </svg>
    </div>
  );
}

type SolutionDotProps = Position & {
  piece: Piece["type"];
};

function SolutionDot({ x, y, piece }: SolutionDotProps) {
  return (
    <div
      className={clsx(
        "relative col-[calc(var(--x)+1)] row-[calc(var(--y)+1)] place-self-center",
        "size-2 rounded-round pointer-events-none opacity-80",
        piece === "puck" ? "bg-ui-2" : "bg-ui-3",
      )}
      style={{ "--x": x, "--y": y }}
    />
  );
}

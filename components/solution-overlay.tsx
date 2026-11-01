import { clsx } from "clsx/lite";

import type { SolutionStep } from "#/game/solution-path.ts";
import type { Position } from "#/game/types.ts";

/**
 * The board's gap as a share of a cell. The real ratio moves a little with the
 * viewport (the gap is fixed, the cell clamps), but across that whole range the
 * drift stays under a pixel, so one constant keeps the drawing plain SVG.
 */
const GAP = 0.085;
const CELLS = 8;
const SPAN = CELLS + (CELLS - 1) * GAP;

/** Badge radius, and how far it sits back from the cell it lands on. */
const BADGE = 0.2;
const SET_BACK = 0.22;

const centre = (value: number) => value * (1 + GAP) + 0.5;

type Line = { from: Position; to: Position };

type Layout = {
  piece: SolutionStep["piece"];
  dashed: boolean;
  lines: Line[];
  badge: Position;
};

type SolutionOverlayProps = {
  steps: SolutionStep[];
  className?: string;
};

/**
 * A solution drawn over the board: each move a line along the cells it really
 * crosses, ending in its number. Puck and blocker moves take their piece's
 * colour, and a move into a hole is dashed. Purely a drawing — sizing and
 * placement on the board come from `className`.
 */
export function SolutionOverlay({ steps, className }: SolutionOverlayProps) {
  const layouts = layoutSteps(steps);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SPAN} ${SPAN}`}
      className={clsx("w-full h-full overflow-visible", className)}
      role="img"
      aria-label={`Solution in ${steps.length} moves`}
    >
      {/* Every line before any badge, so no later move hides an earlier number */}
      {layouts.map((layout, index) => (
        <g key={index} className={pieceColor(layout.piece)}>
          {layout.lines.map(({ from, to }, lineIndex) => (
            <line
              key={lineIndex}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              strokeWidth={0.07}
              strokeLinecap="round"
              strokeDasharray={layout.dashed ? "0.12 0.1" : undefined}
            />
          ))}
        </g>
      ))}

      {layouts.map((layout, index) => (
        <g key={index} className={pieceColor(layout.piece)}>
          <circle
            cx={layout.badge.x}
            cy={layout.badge.y}
            r={BADGE}
            className="fill-surface-1"
            stroke="currentColor"
            strokeWidth={0.04}
          />
          <text
            x={layout.badge.x}
            y={layout.badge.y}
            fill="currentColor"
            fontSize={0.24}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

const pieceColor = (piece: SolutionStep["piece"]) =>
  piece === "puck" ? "text-ui-2" : "text-ui-3";

/**
 * Places every move's lines and badge in board units. A badge sits just short
 * of the cell its move lands on, and backs further up its own line while it
 * would overlap one already placed.
 */
function layoutSteps(steps: SolutionStep[]): Layout[] {
  const badges: Position[] = [];
  const layouts: Layout[] = [];

  for (const step of steps) {
    const legs = step.segments.filter((leg) => leg.length > 1);
    const last = legs.at(-1);
    if (!last) continue;

    const end = last[last.length - 1];
    const before = last[last.length - 2];
    const direction = { x: end.x - before.x, y: end.y - before.y };
    // Never back up past where the final leg started.
    const reach = Math.max(
      Math.abs(end.x - last[0].x),
      Math.abs(end.y - last[0].y),
    ) * (1 + GAP);

    let setBack = SET_BACK;
    const badgeAt = () => ({
      x: centre(end.x) - direction.x * setBack,
      y: centre(end.y) - direction.y * setBack,
    });

    while (
      setBack + BADGE < reach &&
      badges.some((placed) => distance(placed, badgeAt()) < BADGE * 2.1)
    ) {
      setBack += BADGE;
    }

    const badge = badgeAt();
    badges.push(badge);

    layouts.push({
      piece: step.piece,
      dashed: step.outcome === "dropped",
      badge,
      lines: legs.map((leg, legIndex) => ({
        from: { x: centre(leg[0].x), y: centre(leg[0].y) },
        to: legIndex === legs.length - 1 ? badge : {
          x: centre(leg[leg.length - 1].x),
          y: centre(leg[leg.length - 1].y),
        },
      })),
    });
  }

  return layouts;
}

const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);

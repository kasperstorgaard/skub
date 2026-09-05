import { HTMLAttributes, SVGAttributes } from "preact";

import type { Board, Piece, Wall } from "#/game/types.ts";

export type ThumbnailColors = {
  ui1: string; // destination stroke
  ui2: string; // puck fill
  ui3: string; // blocker fill
  ui4: string; // wall stroke
  hole: string; // hole fill
  portal: string; // portal ring stroke
  portalAlt: string; // portal ground behind the rings
};

export const CSS_VAR_COLORS: ThumbnailColors = {
  ui1: "var(--color-ui-1)",
  ui2: "var(--color-ui-2)",
  ui3: "var(--color-ui-3)",
  ui4: "var(--color-ui-4)",
  hole: "var(--color-hole)",
  portal: "var(--color-portal)",
  portalAlt: "var(--color-portal-alt)",
};

export type BoardSvgProps = SVGAttributes<SVGSVGElement> & {
  board: Board;
  width?: number;
  height?: number;
  colors?: ThumbnailColors;
  background?: string;
};

/**
 * Pure SVG board drawing — shared between Thumbnail (CSS vars) and og-image (hardcoded colors).
 */
export function Thumbnail({
  board,
  width = 400,
  height = 400,
  colors = CSS_VAR_COLORS,
  background,
  ...rest
}: BoardSvgProps) {
  const gap = width * 0.02;
  const cellSize = (width - (7 * gap)) / 8;
  const pieceSize = cellSize * 0.7;

  const cellX = (x: number) => x * (cellSize + gap);
  const cellY = (y: number) => y * (cellSize + gap);

  const getCenter = (x: number, y: number) => ({
    cx: cellX(x) + cellSize / 2,
    cy: cellY(y) + cellSize / 2,
  });

  const destination = board.destination;
  const destX = destination ? cellX(destination.x) : 0;
  const destY = destination ? cellY(destination.y) : 0;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      {...rest}
    >
      {background && <rect width={width} height={height} fill={background} />}

      {/* Holes — a plain filled cell; at thumbnail size a texture is noise */}
      {board.holes.map((hole, idx) => (
        <rect
          className="svg-hole"
          key={`hole-${idx}`}
          x={cellX(hole.x)}
          y={cellY(hole.y)}
          width={cellSize}
          height={cellSize}
          rx={cellSize * 0.1}
          fill={colors.hole}
        />
      ))}

      {/* Portals — the board's rings, held still */}
      {board.portals.map((portal, idx) => {
        const { cx, cy } = getCenter(portal.x, portal.y);

        return (
          <g className="svg-portal" key={`portal-${idx}`}>
            <rect
              x={cellX(portal.x)}
              y={cellY(portal.y)}
              width={cellSize}
              height={cellSize}
              rx={cellSize * 0.1}
              fill={colors.portalAlt}
            />
            {[0.46, 0.32, 0.18, 0.06].map((ratio) => (
              <circle
                key={ratio}
                cx={cx}
                cy={cy}
                r={cellSize * ratio}
                fill="none"
                stroke={colors.portal}
                strokeWidth={cellSize * 0.08}
                strokeDasharray={`${cellSize * 0.14} ${cellSize * 0.1}`}
              />
            ))}
          </g>
        );
      })}

      {/* Destination marker — absent while a board is still being built */}
      {destination && (
        <g stroke={colors.ui1} fill="none" className="svg-destination">
          <rect
            x={destX}
            y={destY}
            width={cellSize}
            height={cellSize}
            strokeWidth="2"
          />
          <line
            x1={destX + cellSize * 0.25}
            y1={destY + cellSize * 0.25}
            x2={destX + cellSize * 0.75}
            y2={destY + cellSize * 0.75}
            strokeWidth="3"
            stroke-linecap="round"
          />
          <line
            x1={destX + cellSize * 0.25}
            y1={destY + cellSize * 0.75}
            x2={destX + cellSize * 0.75}
            y2={destY + cellSize * 0.25}
            strokeWidth="3"
            stroke-linecap="round"
          />
        </g>
      )}

      {/* Walls — offset by half the gap so they appear between cells */}
      {board.walls.map((wall: Wall, idx) => {
        const px = cellX(wall.x);
        const py = cellY(wall.y);

        if (wall.orientation === "vertical") {
          return (
            <line
              className="svg-wall"
              key={`wall-${idx}`}
              x1={px - gap / 2}
              y1={py}
              x2={px - gap / 2}
              y2={py + cellSize}
              strokeWidth="3"
              stroke={colors.ui4}
            />
          );
        } else {
          return (
            <line
              className="svg-wall"
              key={`wall-${idx}`}
              x1={px}
              y1={py - gap / 2}
              x2={px + cellSize}
              y2={py - gap / 2}
              strokeWidth="3"
              stroke={colors.ui4}
            />
          );
        }
      })}

      {/* Pieces */}
      {board.pieces.map((piece: Piece, idx) => {
        const { cx, cy } = getCenter(piece.x, piece.y);
        const radius = pieceSize / 2;

        if (piece.type === "puck") {
          return (
            <circle
              className="svg-puck"
              key={`piece-${idx}`}
              cx={cx}
              cy={cy}
              r={radius}
              fill={colors.ui2}
            />
          );
        } else {
          const size = pieceSize;
          const half = size / 2;
          const cornerRadius = size * 0.15;
          return (
            <rect
              className="svg-blocker"
              key={`piece-${idx}`}
              x={cx - half}
              y={cy - half}
              width={size}
              height={size}
              rx={cornerRadius}
              ry={cornerRadius}
              fill={colors.ui3}
            />
          );
        }
      })}
    </svg>
  );
}

export type ThumbnailProps = HTMLAttributes<SVGSVGElement> & {
  board: Board;
  width?: number;
  height?: number;
};

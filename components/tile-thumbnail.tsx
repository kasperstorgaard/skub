import { clsx } from "clsx/lite";

import { TILE_SIZE } from "#/game/tiles.ts";
import type { Tile } from "#/game/types.ts";

type TileThumbnailProps = {
  tile: Tile;
  className?: string;
};

/** Drawing units per cell. Only the ratios matter; the SVG scales to its box. */
const CELL = 10;
const SPAN = TILE_SIZE * CELL;

/**
 * A tile at a glance, server-rendered.
 *
 * A tile is four cells square, so the picture says what walls, blockers and
 * hazards it holds faster than any list of counts could. Walls sit on the cell
 * they block entry into, which is the edge they are drawn on.
 */
export function TileThumbnail({ tile, className }: TileThumbnailProps) {
  return (
    <svg
      viewBox={`0 0 ${SPAN} ${SPAN}`}
      className={clsx("size-16", className)}
      role="presentation"
    >
      <rect
        width={SPAN}
        height={SPAN}
        rx="1"
        fill="var(--color-surface-1)"
        stroke="var(--color-text-3)"
        stroke-width="0.5"
      />

      {/* Cell divisions, faint enough to read the contents over. */}
      {Array.from({ length: TILE_SIZE - 1 }, (_, index) => (index + 1) * CELL)
        .flatMap((at) => [
          <line
            key={`v${at}`}
            x1={at}
            y1="0"
            x2={at}
            y2={SPAN}
            stroke="var(--color-surface-3)"
            stroke-width="0.5"
          />,
          <line
            key={`h${at}`}
            x1="0"
            y1={at}
            x2={SPAN}
            y2={at}
            stroke="var(--color-surface-3)"
            stroke-width="0.5"
          />,
        ])}

      {tile.holes.map((hole) => (
        <rect
          key={`hole-${hole.x}-${hole.y}`}
          x={hole.x * CELL + 2}
          y={hole.y * CELL + 2}
          width={CELL - 4}
          height={CELL - 4}
          rx="1"
          fill="var(--color-hole)"
        />
      ))}

      {tile.portals.map((portal) => (
        <circle
          key={`portal-${portal.x}-${portal.y}`}
          cx={portal.x * CELL + CELL / 2}
          cy={portal.y * CELL + CELL / 2}
          r={CELL / 2 - 2}
          fill="none"
          stroke="var(--color-portal)"
          stroke-width="1.5"
        />
      ))}

      {tile.pieces.map((piece) => (
        <rect
          key={`piece-${piece.x}-${piece.y}`}
          x={piece.x * CELL + 2}
          y={piece.y * CELL + 2}
          width={CELL - 4}
          height={CELL - 4}
          rx="1"
          fill="var(--color-ui-3)"
        />
      ))}

      {tile.walls.map((wall) => (
        <line
          key={`${wall.x}-${wall.y}-${wall.orientation}`}
          x1={wall.x * CELL}
          y1={wall.y * CELL}
          x2={wall.orientation === "horizontal"
            ? wall.x * CELL + CELL
            : wall.x * CELL}
          y2={wall.orientation === "horizontal"
            ? wall.y * CELL
            : wall.y * CELL + CELL}
          stroke="var(--color-ui-4)"
          stroke-width="2"
          stroke-linecap="round"
        />
      ))}
    </svg>
  );
}

import { stringify as stringifyYaml } from "@std/yaml";

import { COLS, isPositionSame } from "#/game/board.ts";
import { Board, Position, type Puzzle } from "#/game/types.ts";

// Combining low line character (U+0332)
const COMBINING_LOW_LINE = "\u0332";

// Combining circumflex accent (U+0302) - indicates piece is on destination
const COMBINING_CIRCUMFLEX = "\u0302";

/**
 * Formats a puzzle into markdown format for easy viewing/editing
 */
export function formatPuzzle(puzzle: Puzzle): string {
  const { board, ...metadata } = puzzle;

  // Fix for "cannot stringify undefined" bug
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) delete metadata[key as keyof typeof metadata];
  }

  // Build frontmatter using YAML stringify
  const yamlContent = stringifyYaml(metadata).trim();
  let markdown = "---\n" + yamlContent + "\n---\n\n";

  // Start code block to prevent markdown formatting
  markdown += "```\n";

  const { header, footer } = formatGridBorder();

  markdown += header + "\n";
  markdown += formatGridBody(board);
  markdown += footer + "\n";

  // End code block
  markdown += "```\n";

  return markdown;
}

/**
 * The chess-notation header and the matching footer rule.
 *
 * Both are derived from the grid width so they can't drift from the rows: a row
 * is a digit, a space, two characters per cell, and the closing border.
 */
export function formatGridBorder(size = COLS) {
  const letters = Array.from(
    { length: size },
    (_, x) => String.fromCharCode(65 + x),
  );

  return {
    header: `+ ${letters.join(" ")} +`,
    footer: `+${"-".repeat(size * 2 + 1)}+`,
  };
}

// Renders the grid rows, one line each, closing border included.
export function formatGridBody(board: Board, size = COLS): string {
  let body = "";

  for (let y = 0; y < size; y++) {
    // Use chess y-axis notation, 1-indexed
    let row = `${y + 1} `;

    for (let x = 0; x < size; x++) {
      // Add the cell contents and separator
      row += formatCell(board, { x, y });
      row += formatCellSeparator(board, { x, y });
    }

    // Add board border and newline
    body += row + "|\n";
  }

  return body;
}

/**
 * Formats a single cell in the board
 * @param board
 * @param position
 * @returns Cell contents, including any combining characters
 */
function formatCell(
  { destination, walls, pieces, holes, portals }: Board,
  position: Position,
) {
  // Horizontal walls are positioned below the cell
  const wallPosition = { x: position.x, y: position.y + 1 };

  const hasHorizontalWall = walls.some((wall) =>
    wall.orientation === "horizontal" && isPositionSame(wall, wallPosition)
  );
  const isDestination = destination != null &&
    isPositionSame(destination, position);

  // Determine cell character
  const piece = pieces.find((item) => isPositionSame(item, position));

  if (piece) {
    let char = piece.type === "puck" ? "@" : "#";
    // Add underline if there's a wall below
    if (hasHorizontalWall) char += COMBINING_LOW_LINE;
    // Add circumflex if piece is on destination
    if (isDestination) char += COMBINING_CIRCUMFLEX;
    return char;
  }

  if (isDestination) {
    const char = "X";
    return hasHorizontalWall ? char + COMBINING_LOW_LINE : char;
  }

  // Nothing can share a cell with a hole or a portal, so no circumflex here.
  const hazard = holes.some((hole) => isPositionSame(hole, position))
    ? "H"
    : portals.some((portal) => isPositionSame(portal, position))
    ? "P"
    : null;

  if (hazard) {
    return hasHorizontalWall ? hazard + COMBINING_LOW_LINE : hazard;
  }

  // Only horizontal wall present
  if (hasHorizontalWall) return "_";

  return " ";
}

/**
 * Formats the separator after a cell
 * @param board
 * @param position
 * @returns Cell separator - " " or "|"
 */
function formatCellSeparator(
  { walls }: Pick<Board, "walls">,
  position: Position,
) {
  // Vertical walls are positioned to the right of the cell
  const wallPosition = { x: position.x + 1, y: position.y };

  const hasVerticalWall = walls.some((wall) =>
    wall.orientation === "vertical" && isPositionSame(wall, wallPosition)
  );

  if (hasVerticalWall) return "|";

  return " ";
}

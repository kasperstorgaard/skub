import { extractYaml } from "@std/front-matter";

import { ROWS, validateBoard } from "#/game/board.ts";
import { Board, Piece, Position, type Puzzle, Wall } from "#/game/types.ts";

/**
 * Parses a markdown-based puzzle format into a Board object.
 *
 * Format:
 * - Metadata is in YAML frontmatter
 * - The board is 8x8, 1 line per row
 * - Characters:
 *   - ` ` (space) = empty cell
 *   - `@` = puck (main piece)
 *   - `@̂` = puck on destination (@ + U+0302)
 *   - `@̲` = puck + horizontal wall below (@ + U+0332)
 *   - `@̲̂` = puck on destination + horizontal wall below (@ + U+0332 + U+0302)
 *   - `#` = blocker (supporting piece)
 *   - `#̂` = blocker on destination (# + U+0302)
 *   - `#̲` = blocker + horizontal wall below (# + U+0332)
 *   - `#̲̂` = blocker on destination + horizontal wall below (# + U+0332 + U+0302)
 *   - `X` = destination (when no piece on it)
 *   - `X̲` = destination + horizontal wall below (X + U+0332)
 *   - `|` = vertical wall (between columns)
 *   - `_` = horizontal wall (standalone, below empty cell)
 *
 * Example:
 * ```
 * ---
 * name: Simple Puzzle
 * slug: simple-puzzle
 * ---
 *
 * A simple puzzle.
 *
 * + A B C D E F G H +
 * 1       @̲ _       |
 * 2 #    |          |
 * 3                 |
 * 4                 |
 * 5                 |
 * 6         _ _     |
 * 7     #           |
 * 8           X|    |
 * +-----------------+
 * ```
 */

// Error thrown when puzzle parsing fails
export class ParserError extends Error {
  constructor(message: string) {
    super(`Puzzle parse error: ${message}`);
    this.name = "PuzzleParseError";
  }
}

// Character mappings for board elements
const CELL_CHARS = {
  puck: "@",
  puckWall: "@̲", // @ + U+0332 (combining low line)
  blocker: "#",
  blockerWall: "#̲", // # + U+0332
  destination: "X",
  destinationWall: "X̲", // X + U+0332
  empty: " ",
  wallVertical: "|",
  wallHorizontal: "_",
} as const;

// Combining low line character (U+0332)
const COMBINING_LOW_LINE = "\u0332";
// Combining circumflex accent (U+0302) - indicates piece is on destination
const COMBINING_CIRCUMFLEX = "\u0302";

/**
 * Parses the board grid into pieces, walls, and destination
 */
function parseBoard(rows: string[]): Board {
  const pieces: Piece[] = [];
  let destination: Position | undefined;
  const walls: Wall[] = [];

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];

    // Row content is already extracted (no row number prefix)
    const cellContent = row;

    // Track the actual string index as we process combined characters
    let stringIndex = 0;

    for (let x = 0; x < 8; x++) {
      // Each cell should be at position x*2, but combining characters shift the indices
      if (stringIndex >= cellContent.length) break;

      const char = cellContent[stringIndex];

      // Check for combining characters after the main character (up to 2)
      // They can appear in any order: U+0332 (underline) and/or U+0302 (circumflex)
      let hasCircumflex = false;
      let hasUnderline = false;
      let combiningCharsCount = 0;

      for (let i = 1; i <= 2; i++) {
        const nextIndex = stringIndex + i;
        if (nextIndex >= cellContent.length) break;

        const nextChar = cellContent[nextIndex];
        if (nextChar === COMBINING_LOW_LINE && !hasUnderline) {
          hasUnderline = true;
          combiningCharsCount++;
        } else if (nextChar === COMBINING_CIRCUMFLEX && !hasCircumflex) {
          hasCircumflex = true;
          combiningCharsCount++;
        } else {
          // Not a combining character, stop looking
          break;
        }
      }

      // The separator comes after the base character and any combining characters
      const separatorIndex = stringIndex + 1 + combiningCharsCount;
      const separator = separatorIndex < cellContent.length
        ? cellContent[separatorIndex]
        : " ";

      // Check for vertical wall separator
      if (separator === CELL_CHARS.wallVertical) {
        walls.push({ x: x + 1, y, orientation: "vertical" });
      }

      // Move to the next cell (past the separator)
      stringIndex = separatorIndex + 1;

      // If the cell itself is a vertical wall, it's positioned between this cell and the previous
      // Wall at x means it's to the right of column x
      if (char === CELL_CHARS.wallVertical) {
        if (x > 0) {
          walls.push({ x: x, y, orientation: "vertical" });
        }
        continue;
      }

      // Check for horizontal wall standalone
      if (char === CELL_CHARS.wallHorizontal) {
        walls.push({ x, y: y + 1, orientation: "horizontal" });
        continue;
      }

      // Check for puck
      if (char === "@") {
        pieces.push({ x, y, type: "puck" });

        // If this piece has circumflex, it's on the destination
        if (hasCircumflex) {
          if (destination) {
            throw new ParserError("Multiple destinations found");
          }
          destination = { x, y };
        }

        if (hasUnderline) {
          walls.push({ x, y: y + 1, orientation: "horizontal" });
        }

        continue;
      }

      // Check for blocker
      if (char === "#") {
        pieces.push({ x, y, type: "blocker" });

        // If this piece has circumflex, it's on the destination
        if (hasCircumflex) {
          if (destination) {
            throw new ParserError("Multiple destinations found");
          }
          destination = { x, y };
        }

        if (hasUnderline) {
          walls.push({ x, y: y + 1, orientation: "horizontal" });
        }

        continue;
      }

      // Check for destination
      if (char === "X") {
        if (destination) {
          throw new ParserError("Multiple destinations found");
        }

        destination = { x, y };
        if (hasUnderline) {
          walls.push({ x, y: y + 1, orientation: "horizontal" });
        }
        continue;
      }

      // Empty space - but check for underline modifier
      if (char === " ") {
        // Space with underline means a horizontal wall below this empty cell
        if (hasUnderline) {
          walls.push({ x, y: y + 1, orientation: "horizontal" });
        }
        continue;
      }

      // Skip modifiers that might appear standalone
      if (char === COMBINING_LOW_LINE || char === COMBINING_CIRCUMFLEX) {
        continue;
      }

      throw new ParserError(
        `Unknown cell character '${char}' at position (${x}, ${y})`,
      );
    }
  }

  return validateBoard({
    destination,
    pieces,
    walls,
  });
}

/**
 * Main parser function - parses a markdown puzzle file into a ParsedPuzzle
 */
export function parsePuzzle(
  content: string,
): Puzzle {
  const { attrs, body } = extractYaml<Omit<Puzzle, "board">>(content);

  if (!attrs.name) {
    throw new ParserError("Metadata must include 'name' field");
  }

  const rows = extractRows(body);
  if (rows.length !== ROWS) {
    throw new ParserError(`Expected ${ROWS} board rows, found ${rows.length}`);
  }

  const board = parseBoard(rows);

  return {
    ...attrs,
    board,
  };
}

/**
 * Extracts the board rows from the content.
 */
function extractRows(content: string): string[] {
  const lines = content.split(/[\r\n]/);
  const rows: string[] = [];

  // Capture cell content between the row number and the trailing boundary `|`.
  // Variable length so combining marks (e.g. `X̲`, `#̲`) don't push the last cell
  // out of the capture window.
  const rowMatcher = /^[1-8]\s(.+?)\s\|\s*$/;
  let inGrid = false;

  for (const line of lines) {
    // Skip code block markers
    if (line.trim() === "```") continue;

    if (isHeader(line)) {
      inGrid = true;
      continue;
    }
    if (isFooter(line)) break;
    if (!inGrid) continue;

    const rowMatches = line.match(rowMatcher) ?? [];
    if (rowMatches[1]) rows.push(rowMatches[1]);
  }

  return rows;
}

/**
 * Checks if a line is the header (starts with +)
 */
function isHeader(line: string) {
  return /^\s*\+\sA/.test(line);
}

/**
 * Checks if a line is the footer (starts with +-)
 */
function isFooter(line: string) {
  return /^\s*\+-/.test(line);
}

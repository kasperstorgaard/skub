import type { Move, Position } from "#/game/types.ts";

const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * Encodes a position to chess notation (e.g., A1, H8)
 * @param position - Position with x (0-7) and y (0-7)
 * @returns Chess notation string (e.g., "A1", "H8")
 */
export function encodePosition(position: Position): string {
  if (position.x < 0 || position.x > 7) {
    throw new Error("Position x must be between 0 and 7");
  }
  if (position.y < 0 || position.y > 7) {
    throw new Error("Position y must be between 0 and 7");
  }

  const column = COLUMNS[position.x];
  const row = (position.y + 1).toString(); // Convert 0-7 to 1-8

  return column + row;
}

/**
 * Decodes chess notation to a position
 * @param notation - Chess notation (e.g., "A1", "H8")
 * @returns Position object with x and y coordinates
 */
export function decodePosition(notation: string): Position {
  if (notation.length !== 2) {
    throw new Error("Invalid chess notation format");
  }

  const column = notation[0].toUpperCase();
  const row = notation[1];

  const x = COLUMNS.indexOf(column);
  if (x === -1) {
    throw new Error(`Invalid column: ${column}`);
  }

  const y = parseInt(row, 10) - 1; // Convert 1-8 to 0-7
  if (isNaN(y) || y < 0 || y > 7) {
    throw new Error(`Invalid row: ${row}`);
  }

  return { x, y };
}

/**
 * Encodes a move to chess notation (e.g., A1B2)
 * @param move - Array of two positions [from, to]
 * @returns Chess notation string (e.g., "A1B2")
 */
export function encodeMove(move: Move): string {
  return encodePosition(move[0]) + encodePosition(move[1]);
}

/**
 * Encode moves with shorthand: if a move starts where the previous ended,
 * only encode the destination (e.g., "A1F1-F6" instead of "A1F1-F1F6").
 *
 * A slide through a portal writes the portal it went in by, then "x", then
 * where it came to rest — "A8xA1" — because two routes can share both
 * endpoints and the pair alone can't say which was taken.
 */
export function encodeMoves(moves: Move[]): string {
  return moves.map((move, index) => {
    const [from, to, entry] = move;

    // The path runs as far as the portal; the rest position follows the "x".
    const stop = entry ?? to;
    const transit = entry ? `x${encodePosition(to)}` : "";

    const previous = index > 0 ? encodePosition(moves[index - 1][1]) : null;
    const start = previous === encodePosition(from) ? "" : encodePosition(from);

    return start + encodePosition(stop) + transit;
  }).join("-");
}

/**
 * Decodes chess notation move to Move object
 * @param notation - Chess notation move (e.g., "A1B2")
 * @returns Move array [from, to]
 */
export function decodeMove(notation: string): Move {
  if (notation.length !== 4) {
    throw new Error("Invalid move format - expected 4 characters");
  }

  const from = decodePosition(notation.substring(0, 2));
  const to = decodePosition(notation.substring(2, 4));

  return [from, to];
}

// Decodes a dash-separated move string, supporting shorthand notation and the
// "x" a portal slide writes between the portal it took and where it stopped.
export function decodeMoves(encodedMoves: string): Move[] {
  const moves: Move[] = [];

  let lastEndPosition: Position | undefined;

  for (const encoded of encodedMoves.split("-")) {
    const [path, rested] = encoded.split("x");

    let from: Position;
    let stop: Position;

    if (path.length === 2) {
      // Shorthand: only destination provided, use last end position as start
      if (!lastEndPosition) {
        throw new Error(
          "Invalid move sequence: shorthand used without previous move",
        );
      }

      from = lastEndPosition;
      stop = decodePosition(path);
    } else if (path.length === 4) {
      from = decodePosition(path.substring(0, 2));
      stop = decodePosition(path.substring(2, 4));
    } else {
      throw new Error(`Invalid move format: ${encoded}`);
    }

    // Without an "x" the path already ran to the rest position.
    const to = rested ? decodePosition(rested) : stop;

    moves.push(rested ? [from, to, stop] : [from, to]);
    lastEndPosition = to;
  }

  return moves;
}

/**
 * Returns a stable deduplication key for a set of moves.
 * Two solutions with the same moves in different order produce the same key.
 * Uses full move notation (encodeMove, not encodeMoves) so each move is
 * independently sortable regardless of sequence.
 */
export function getCanonicalMoveKey(moves: Move[]): string {
  return moves.map(encodeMove).sort().join("-");
}

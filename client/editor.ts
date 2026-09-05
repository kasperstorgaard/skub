import { type Signal } from "@preact/signals";
import { useCallback, useMemo } from "preact/hooks";

import { getCellContent, isPositionSame } from "#/game/board.ts";
import {
  CELL_CONTENTS,
  type CellContent,
  type Position,
  type Puzzle,
  type Wall,
} from "#/game/types.ts";

/**
 * Current state for the editor
 */
type UseEditorOptions = {
  // The puzzle being edited (empty board for new puzzles)
  puzzle: Signal<Puzzle>;
  // The active position, eg. the cell the user has selected
  active?: Position;
};

/**
 * Hook for editor functionality.
 * Returns handlers for mutating the board at the active position.
 */
export function useEditor(
  { active, puzzle }: UseEditorOptions,
) {
  const toggleWall = useCallback(
    (target: Wall["orientation"] | "both" | null) => {
      if (!active) return;

      // store matches of the active position
      const matches = puzzle.value.board.walls.filter((wall) =>
        isPositionSame(wall, active)
      );

      // clear the walls matching active as a starting point
      let walls = puzzle.value.board.walls.filter((wall) =>
        !isPositionSame(wall, active)
      );

      // No target, clear walls
      if (!target) {
        updateBoard(puzzle, { walls });
        return;
      }

      // Target is the same as current matches, clear walls
      if (
        (matches.length === 1 && matches[0].orientation === target) ||
        (target === "both" && matches.length === 2)
      ) {
        updateBoard(puzzle, { walls });
        return;
      }

      // Add whatever walls are desired
      if (target === "both" || target === "horizontal") {
        walls = [...walls, { ...active, orientation: "horizontal" as const }];
      }

      if (target === "both" || target === "vertical") {
        walls = [...walls, { ...active, orientation: "vertical" as const }];
      }

      updateBoard(puzzle, { walls });
    },
    [active, puzzle],
  );

  const setCellContent = useCallback(
    (content: CellContent | null) => {
      if (!active) return;

      const board = puzzle.value.board;
      // Setting what is already there clears the cell instead.
      const target = content === getCellContent(board, active) ? null : content;

      // The destination has nowhere else to go, and a cell is written down as
      // one character, so a hazard cannot take its cell.
      if (target && !canHold(board, active, target)) return;

      // A cell holds one thing, so start by emptying it.
      let pieces = board.pieces.filter((piece) =>
        !isPositionSame(piece, active)
      );
      const holes = board.holes.filter((hole) => !isPositionSame(hole, active));
      let portals = board.portals.filter((portal) =>
        !isPositionSame(portal, active)
      );

      if (target === "puck") {
        // Puck is unique — remove any existing puck at other positions
        pieces = pieces.filter((piece) => piece.type !== "puck");
      }

      if (target === "puck" || target === "blocker") {
        pieces = [...pieces, { ...active, type: target }];
      } else if (target === "hole") {
        holes.push({ ...active });
      } else if (target === "portal") {
        // Portals work in pairs, so a third one retires the oldest.
        portals = [...portals, { ...active }].slice(-2);
      }

      updateBoard(puzzle, { pieces, holes, portals });
    },
    [active, puzzle],
  );

  const setDestination = useCallback(() => {
    if (!active) return;

    // Nothing can sit under the destination, and a board carrying both cannot
    // be written down: the cell has one character.
    updateBoard(puzzle, {
      destination: active,
      holes: puzzle.value.board.holes.filter((hole) =>
        !isPositionSame(hole, active)
      ),
      portals: puzzle.value.board.portals.filter((portal) =>
        !isPositionSame(portal, active)
      ),
    });
  }, [active, puzzle]);

  const cycleWall = useCallback(() => {
    if (!active) return;

    const { walls } = puzzle.value.board;
    const activeWalls = walls.filter((wall) => isPositionSame(wall, active));

    if (activeWalls.length === 0) {
      toggleWall("horizontal");
    } else if (
      activeWalls.length === 1 &&
      activeWalls[0].orientation === "horizontal"
    ) {
      toggleWall("vertical");
    } else if (
      activeWalls.length === 1 &&
      activeWalls[0].orientation === "vertical"
    ) {
      toggleWall("both");
    } else {
      toggleWall(null);
    }
  }, [active, puzzle]);

  const cycleCell = useCallback(() => {
    if (!active) return;

    const board = puzzle.value.board;
    // Skip what this cell cannot hold, rather than stalling the cycle on it.
    const available = CELL_CONTENTS.filter((content) =>
      canHold(board, active, content)
    );

    const current = getCellContent(board, active);
    const index = current ? available.indexOf(current) : -1;

    // Past the last content the cycle empties the cell again.
    setCellContent(available[index + 1] ?? null);
  }, [active, puzzle, setCellContent]);

  // What the toolbar can offer for the active cell.
  const allowed = useMemo(
    () =>
      CELL_CONTENTS.filter((content) =>
        active ? canHold(puzzle.value.board, active, content) : true
      ),
    [active, puzzle.value.board],
  );

  return {
    toggleWall,
    setCellContent,
    setDestination,
    cycleWall,
    cycleCell,
    allowed,
  };
}

/**
 * Whether a cell can hold a given content.
 *
 * Everything can share a cell with everything else by being cleared first — a
 * cell holds one thing. The exception is the destination: every board has
 * exactly one, so there is no state to clear it to, and the board format writes
 * a cell as a single character, so it cannot record a hazard sitting on it
 * either.
 */
function canHold(
  board: Puzzle["board"],
  position: Position,
  content: CellContent,
): boolean {
  if (content !== "hole" && content !== "portal") return true;

  return !isPositionSame(board.destination, position);
}

// Applies a board mutation to the puzzle signal, clearing minMoves.
function updateBoard(
  puzzle: Signal<Puzzle>,
  patch: Partial<Puzzle["board"]>,
) {
  puzzle.value = {
    ...puzzle.value,
    board: { ...puzzle.value.board, ...patch },
    minMoves: 0,
  };
}

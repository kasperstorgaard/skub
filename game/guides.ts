import {
  getMoveSlide,
  getSlides,
  isMoveSame,
  type SlideBoard,
} from "./board.ts";
import { Move, Position } from "./types.ts";

/** A move guide shown on the board, optionally flagged as a hint. */
export type Guide = {
  move: Move;
  /**
   * The cell the guide is drawn to — the end of the slide's first leg.
   *
   * Same as `move[1]` for an ordinary slide. For one that teleports it is the
   * entry portal, so the strip and its target stay on-axis with the piece and
   * never give away where a portal comes out.
   */
  to: Position;
  isHint: boolean;
};

/**
 * Builds a list of move guides for the active piece.
 * Each guide represents a direction the piece can move, with a guide strip + target.
 * If a hint is provided and matches a target direction, it replaces that target.
 */
export function getGuides(
  board: SlideBoard,
  { active, hint }: { active?: Position; hint?: Move },
): Guide[] {
  const result: Guide[] = [];

  if (active) {
    for (const slide of Object.values(getSlides(active, board))) {
      const [firstLeg] = slide.segments;

      result.push({
        move: [active, slide.target],
        to: firstLeg[firstLeg.length - 1],
        isHint: false,
      });
    }
  }

  if (hint) {
    const target = result.find((item) => isMoveSame(item.move, hint));
    const insertIdx = target ? result.indexOf(target) : result.length;

    // A hint arrives without a selected piece, so there is usually no guide to
    // borrow from. Resolving its own slide is what keeps it stopping at the
    // portal — falling back to the move's endpoint would both point off-axis
    // and give away where the portal comes out.
    const [firstLeg] = getMoveSlide(hint, board)?.segments ?? [];

    result.splice(insertIdx, 1, {
      move: hint,
      to: target?.to ?? firstLeg?.[firstLeg.length - 1] ?? hint[1],
      isHint: true,
    });
  }

  return result;
}

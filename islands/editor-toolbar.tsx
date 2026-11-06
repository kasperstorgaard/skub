import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { useEditor } from "#/client/editor.ts";
import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  FlipHorizontal,
  FlipVertical,
  Icon,
  Play,
  Trash,
  X,
} from "#/components/icons.tsx";
import { KeyHint } from "#/components/key-hint.tsx";
import { PortalRings } from "#/components/portal-rings.tsx";
import { TOOL_BUTTON, Toolbar } from "#/components/toolbar.tsx";
import { flipBoard, rotateBoard } from "#/game/board.ts";
import type { Board, Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";

type EditorToolbarProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  className?: string;
};

/**
 * Toolbar for the puzzle editor: the board actions and play, and the cell tools.
 * On mobile: a carousel inline inside Main, flicked or paged by its arrow;
 * selecting a cell brings the tools.
 * On desktop: a column, to the right of Main via absolute positioning, with the
 * tools while a cell is selected and a close button back to the actions.
 */
export function EditorToolbar(
  { href, puzzle, className }: EditorToolbarProps,
) {
  const active = useMemo(
    () => decodeState(href.value).active,
    [href.value],
  );

  const { toggleWall, setCellContent, setDestination } = useEditor({
    puzzle,
    active,
  });

  const updateBoard = (board: Board) => {
    puzzle.value = { ...puzzle.value, board };
  };

  const isSelected = active != null;

  const deselectHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.delete("active");
    return url.href;
  }, [href.value]);

  const scroller = useRef<HTMLDivElement>(null);
  // The slide in view: 0 board actions, 1 cell tools
  const [slide, setSlide] = useState(0);

  const scrollTo = (index: number, behavior: ScrollBehavior = "smooth") => {
    const element = scroller.current;
    if (!element) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({
      left: index * element.clientWidth,
      behavior: reduce ? "instant" : behavior,
    });
  };

  // Selecting a cell brings the tools, deselecting the board actions;
  // straight there on load.
  const hasMounted = useRef(false);
  useEffect(() => {
    const behavior = hasMounted.current ? "smooth" : "instant";
    if (isSelected) scrollTo(1, behavior);
    else if (hasMounted.current) scrollTo(0, behavior);
    hasMounted.current = true;
  }, [active?.x, active?.y]);

  return (
    // Mobile: a full-bleed carousel of two snapping slides, board actions and
    // cell tools, with an arrow to the other one. Desktop: one group at a time.
    <div
      className={clsx(
        // As tall as the 3rem buttons; the strip inside is out of flow, so
        // its width can't widen Main's column
        "max-lg:relative max-lg:h-12",
        className,
      )}
    >
      <div className="max-lg:absolute max-lg:inset-y-0 max-lg:left-[calc(50%-50vw)] max-lg:w-screen max-lg:overflow-hidden">
        <div
          ref={scroller}
          onScroll={(event) => {
            const { scrollLeft, clientWidth } = event.currentTarget;
            setSlide(Math.round(scrollLeft / clientWidth));
          }}
          className={clsx(
            "max-lg:grid max-lg:grid-flow-col max-lg:auto-cols-[100%] max-lg:h-full",
            "max-lg:overflow-x-auto max-lg:snap-x max-lg:snap-mandatory no-scrollbar",
            "lg:flex lg:flex-col lg:items-center lg:gap-4",
          )}
        >
          {/* Slides pad both ends, so the arrow never covers a button */}
          {/* Play set apart: further along the row, its own group in the column */}
          <div
            className={clsx(
              "flex items-center justify-center gap-10 max-lg:px-7 max-lg:snap-start",
              "lg:flex-col lg:gap-4",
              isSelected && "lg:hidden",
            )}
          >
            {/* No keys: the button column, not flowing into the hints' */}
            {/* TODO: add a shake/shuffle button that does something random to the board */}
            <Toolbar>
              <button
                type="button"
                className={clsx(TOOL_BUTTON, "lg:col-1")}
                aria-label="Rotate 90°"
                onClick={() =>
                  updateBoard(rotateBoard(puzzle.value.board, "right"))}
              >
                <Icon icon={ArrowClockwise} className="text-[1.25rem]" />
              </button>

              <button
                type="button"
                className={clsx(TOOL_BUTTON, "lg:col-1")}
                aria-label="Mirror horizontally"
                onClick={() =>
                  updateBoard(flipBoard(puzzle.value.board, "horizontal"))}
              >
                <Icon icon={FlipHorizontal} className="text-[1.25rem]" />
              </button>

              <button
                type="button"
                className={clsx(TOOL_BUTTON, "lg:col-1")}
                aria-label="Mirror vertically"
                onClick={() =>
                  updateBoard(flipBoard(puzzle.value.board, "vertical"))}
              >
                <Icon icon={FlipVertical} className="text-[1.25rem]" />
              </button>

              <button
                type="button"
                className={clsx(TOOL_BUTTON, "lg:col-1")}
                aria-label="Clear"
                onClick={() => {
                  puzzle.value = {
                    ...puzzle.value,
                    board: {
                      destination: { x: 3, y: 3 },
                      pieces: [],
                      walls: [],
                      holes: [],
                      portals: [],
                    },
                    minMoves: 0,
                  };
                }}
              >
                <Icon icon={Trash} className="text-[1.25rem]" />
              </button>
            </Toolbar>

            <Toolbar>
              <a
                href="/puzzles/preview"
                target="_blank"
                className={clsx(TOOL_BUTTON, "lg:col-1")}
                aria-label="Play"
                title="Play the puzzle"
              >
                <Icon icon={Play} className="text-[1.25rem]" />
              </a>
            </Toolbar>
          </div>

          <div
            className={clsx(
              "flex items-center justify-center max-lg:px-7 max-lg:snap-start",
              "lg:flex-col lg:gap-3",
              !isSelected && "lg:hidden",
            )}
          >
            {
              /* Desktop: the way back to the board actions. The toolbar's own
                columns, so it centres over the buttons, not the key hints */
            }
            <div className="max-lg:hidden lg:grid lg:grid-cols-[auto_1.5rem] lg:gap-1">
              <a
                href={deselectHref}
                data-router="replace"
                // Not a tool: a muted circle above them
                className={clsx(
                  "grid place-items-center size-7",
                  "rounded-round bg-text-1/10 text-text-2 no-underline",
                  "hover:text-text-1",
                )}
                aria-label="Close the cell tools"
                title="Close the cell tools"
              >
                <Icon icon={X} className="text-[1.25rem]" />
              </a>
            </div>

            <Toolbar className="max-lg:w-full">
              <button
                type="button"
                className={TOOL_BUTTON}
                aria-label="Horizontal wall"
                disabled={!isSelected}
                onClick={() => toggleWall("horizontal")}
              >
                <div className="size-5 border-t-[3px] border-ui-4" />
              </button>

              <button
                type="button"
                className={TOOL_BUTTON}
                aria-label="Vertical wall"
                disabled={!isSelected}
                onClick={() => toggleWall("vertical")}
              >
                <div className="size-5 border-l-[3px] border-ui-4" />
              </button>

              <KeyHint className="row-[1/3]">W</KeyHint>

              <button
                type="button"
                className={TOOL_BUTTON}
                aria-label="Blocker"
                disabled={!isSelected}
                onClick={() => setCellContent("blocker")}
              >
                <div className="size-5 bg-ui-3 rounded-1" />
              </button>

              <button
                type="button"
                className={TOOL_BUTTON}
                aria-label="Puck"
                disabled={!isSelected}
                onClick={() => setCellContent("puck")}
              >
                <div className="size-5 bg-ui-2 rounded-round" />
              </button>

              <button
                type="button"
                className={TOOL_BUTTON}
                aria-label="Hole"
                disabled={!isSelected}
                onClick={() => setCellContent("hole")}
              >
                <div className="size-5 bg-hole rounded-1" />
              </button>

              <button
                type="button"
                className={TOOL_BUTTON}
                aria-label="Portal"
                disabled={!isSelected}
                onClick={() => setCellContent("portal")}
              >
                <div className="size-5 rounded-1 overflow-hidden bg-portal-alt relative">
                  <PortalRings compact />
                </div>
              </button>

              {/* The bracket spans the cell buttons it belongs to. */}
              <KeyHint className="row-[3/7]">P</KeyHint>

              <button
                type="button"
                className={TOOL_BUTTON}
                aria-label="Destination"
                disabled={!isSelected}
                onClick={setDestination}
              >
                <div className="size-5 border-2 border-ui-1 flex items-center justify-center">
                  <Icon icon={X} className="text-ui-1 text-fl-0" />
                </div>
              </button>

              <KeyHint>D</KeyHint>
            </Toolbar>
          </div>
        </div>

        {/* Mobile: points at the other slide, and goes there */}
        <button
          type="button"
          onClick={() => scrollTo(slide ? 0 : 1)}
          className={clsx(
            // 3.5rem wide, centred on the screen's edge: half of it shows.
            // 2.5rem tall, inside the 3rem strip, so only the edge cuts it.
            "lg:hidden absolute top-1/2 -translate-y-1/2 w-[3.5rem] h-[2.5rem]",
            slide ? "-left-[1.75rem]" : "-right-[1.75rem]",
            "grid place-items-center rounded-2 bg-text-1/10 text-text-2",
            "hover:text-text-1",
          )}
          aria-label={slide ? "Board actions" : "Cell tools"}
          title={slide ? "Board actions" : "Cell tools"}
        >
          <Icon
            icon={slide ? CaretLeft : CaretRight}
            className={clsx(
              "text-[1.25rem]",
              // Into the half that shows
              slide ? "translate-x-[0.9rem]" : "-translate-x-[0.9rem]",
            )}
          />
        </button>
      </div>
    </div>
  );
}

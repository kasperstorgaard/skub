import { type Signal, useComputed } from "@preact/signals";
import { useCallback } from "preact/hooks";

import {
  ArrowClockwise,
  FlipHorizontal,
  Icon,
  Star,
  Trash,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import {
  categorizeTile,
  countLanes,
  flipTile,
  rotateTile,
  TILE_SIZE,
  validateTile,
} from "#/game/tiles.ts";
import type { Puzzle } from "#/game/types.ts";

type TilePanelProps = { puzzle: Signal<Puzzle> };

const EMPTY_BOARD = {
  destination: undefined,
  pieces: [],
  walls: [],
  holes: [],
  portals: [],
};

/**
 * Side panel for the tile builder: what the tile reads as, and the way out.
 *
 * The category is derived rather than typed — hazards settle it, and openness
 * decides the rest — so what the panel shows is what the file will be filed as.
 */
export function TilePanel({ puzzle }: TilePanelProps) {
  const reading = useComputed(() => {
    const tile = puzzle.value.board;

    try {
      validateTile(tile);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }

    return {
      category: categorizeTile(tile),
      lanes: countLanes(tile),
      blockers: tile.pieces.length,
    };
  });

  // Autosave is debounced and a navigation cancels the request in flight, so
  // saving stores the tile on screen first.
  const onSave = useCallback(async (event: Event) => {
    event.preventDefault();
    // An invalid tile has nothing to file; the panel already says why.
    if (reading.value.error) return;

    try {
      await fetch("/api/store-tile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: puzzle.value.board,
          id: puzzle.value.slug,
        }),
      });
    } catch {
      // Fall through: the draft in KV is the next best thing.
    }

    globalThis.location.href = "/tiles/save";
  }, [puzzle, reading]);

  const onClear = useCallback(() => {
    puzzle.value = { ...puzzle.value, board: { ...EMPTY_BOARD }, minMoves: 0 };
  }, [puzzle]);

  return (
    <Panel>
      <p className="col-[2/3] text-fl-1 mb-fl-4 leading-tight lg:row-[1/3] lg:text-fl-0 lg:mb-0">
        A tile is a quarter of a board. No puck, no destination, and never a
        wall on its own edge.
      </p>

      <div className="flex flex-col col-[2/3] lg:row-[3/4] gap-fl-4 lg:gap-fl-1 place-content-between">
        <div className="flex flex-col gap-fl-1">
          <div className="flex gap-fl-1 flex-wrap lg:justify-center">
            <button
              type="button"
              className="icon-btn"
              data-size="sm"
              onClick={() => {
                puzzle.value = {
                  ...puzzle.value,
                  board: rotateTile(puzzle.value.board, 1),
                };
              }}
            >
              <Icon icon={ArrowClockwise} />
              <span className="sr-only">Rotate 90°</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              data-size="sm"
              onClick={() => {
                puzzle.value = {
                  ...puzzle.value,
                  board: flipTile(puzzle.value.board),
                };
              }}
            >
              <Icon icon={FlipHorizontal} />
              <span className="sr-only">Mirror horizontally</span>
            </button>
          </div>

          {reading.value.error
            ? <p className="text-fl-0 text-brand">{reading.value.error}</p>
            : (
              <dl className="grid grid-cols-2 gap-x-fl-1 text-fl-0 text-text-3">
                <dt>Category</dt>
                <dd className="text-text-1">
                  {reading.value.category} ({reading.value.lanes}/{TILE_SIZE *
                    2})
                </dd>
                <dt>Blockers</dt>
                <dd className="text-text-1">{reading.value.blockers}</dd>
              </dl>
            )}

          <button type="button" className="btn" onClick={onClear}>
            <Icon icon={Trash} />
            Clear
          </button>
        </div>

        <a
          href="/tiles/save"
          className="btn"
          onClick={onSave}
          aria-disabled={Boolean(reading.value.error)}
        >
          <Icon icon={Star} /> Save tile
        </a>
      </div>
    </Panel>
  );
}

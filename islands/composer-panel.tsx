import { type Signal, useComputed } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback } from "preact/hooks";

import { useComposer } from "#/client/composer.ts";
import {
  Eye,
  Icon,
  PencilSimple,
  Play,
  Repeat,
  Shuffle,
  Star,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { TileConfig } from "#/components/tile-config.tsx";
import { formatPuzzle } from "#/game/formatter.ts";
import {
  type ComposerConfig,
  composerStep,
  type DealtTile,
  encodePlacements,
  toPlacements,
} from "#/game/tiles.ts";
import type { Puzzle, TileEntry } from "#/game/types.ts";
import type { DiceThrows } from "#/lib/dice.ts";

type ComposerPanelProps = {
  puzzle: Signal<Puzzle>;
  config: Signal<ComposerConfig>;
  dealt: Signal<DealtTile[]>;
  /** Where a roll leaves its throws, for the board to play out. */
  dice: Signal<DiceThrows | null>;
  catalog: TileEntry[];
};

/**
 * The composer's sidebar: how to deal, the two actions that move a board
 * forward, and the ways out. Arranging what has been dealt happens beside the
 * board, where the tiles are.
 */
export function ComposerPanel(
  { puzzle, config, dealt, dice, catalog }: ComposerPanelProps,
) {
  // Derived here rather than handed in: a computed made on the page arrives as
  // the value it had when the island was rendered, and stops tracking.
  const step = useComputed(() => composerStep(puzzle.value.board));

  const { deal, roll } = useComposer({ puzzle, dealt, config, catalog, dice });

  // Autosave is debounced and a navigation cancels the request in flight, so
  // Review stores the board on screen first.
  const onReview = useCallback(async (event: Event) => {
    event.preventDefault();

    try {
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: formatPuzzle(puzzle.value) }),
      });
    } catch {
      // Fall through: the draft in KV is the next best thing.
    }

    const tiles = dealt.value.length
      ? `?tiles=${
        encodeURIComponent(encodePlacements(toPlacements(dealt.value)))
      }`
      : "";

    globalThis.location.href = `/candidate/review${tiles}`;
  }, [dealt, puzzle]);

  return (
    <Panel>
      <div
        className={clsx(
          "flex flex-col col-[2/3] lg:row-[1/4] gap-fl-4",
          "lg:gap-fl-2 place-content-between",
        )}
      >
        <div className="flex flex-col gap-fl-2">
          <TileConfig config={config} />

          {/* The two actions that move a board on, read as one pair. */}
          <div className="flex flex-col gap-fl-1">
            <button type="button" className="btn" onClick={deal}>
              <Icon icon={Shuffle} /> Generate
            </button>

            {step.value !== "deal" && (
              <button type="button" className="btn" onClick={roll}>
                <Icon icon={Play} />
                {step.value === "roll" ? "Roll again" : "Roll"}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-fl-1">
          <a href="/puzzles/build" className="btn">
            <Icon icon={PencilSimple} /> Edit by hand
          </a>

          <a href="/tiles" className="btn">
            <Icon icon={Repeat} /> Tile library
          </a>

          <a href="/puzzles/preview" className="btn" target="_blank">
            <Icon icon={Eye} /> Preview
          </a>

          <a href="/candidate/review" className="btn" onClick={onReview}>
            <Icon icon={Star} /> Review
          </a>
        </div>
      </div>
    </Panel>
  );
}

import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useEffect } from "preact/hooks";

import { useComposer } from "#/client/composer.ts";
import {
  ArrowClockwise,
  FlipHorizontal,
  Icon,
  Repeat,
  Shuffle,
} from "#/components/icons.tsx";
import { KeyHint } from "#/components/key-hint.tsx";
import type { ComposerConfig, DealtTile } from "#/game/tiles.ts";
import type { Puzzle, TileEntry } from "#/game/types.ts";

type TileArrangerProps = {
  puzzle: Signal<Puzzle>;
  dealt: Signal<DealtTile[]>;
  config: Signal<ComposerConfig>;
  /** The quadrant in hand, picked on the board itself. */
  quadrant: Signal<number | null>;
  catalog: TileEntry[];
  className?: string;
};

/**
 * The composer's board-side controls, laid out like the editor's toolbar
 * because they stand where it stands: a button, and the key that does the same.
 *
 * A tile is what these act on, so pick one on the board first. Shift widens each
 * to the whole board, which is a dihedral transform — it never changes what the
 * board is worth solving.
 */
export function TileArranger(
  { puzzle, dealt, config, quadrant, catalog, className }: TileArrangerProps,
) {
  const { deal, shuffle, transform, swap, wholeBoard } = useComposer({
    puzzle,
    dealt,
    config,
    catalog,
  });

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.isContentEditable || target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"
      ) return;

      const key = event.key.toLowerCase();
      const inHand = quadrant.value;

      // Shift means the whole board rather than the tile in hand.
      if (event.shiftKey) {
        if (key === "s") return deal();
        if (key === "r") return wholeBoard("rotate");
        if (key === "f") return wholeBoard("flip");
        return;
      }

      if (key === "s") return shuffle();
      if (inHand == null) return;

      if (key === "r") return transform(inHand, "rotate");
      if (key === "f") return transform(inHand, "flip");
      if (key === "x") return swap(inHand);
    };

    self.addEventListener("keyup", onKeyUp);
    return () => self.removeEventListener("keyup", onKeyUp);
  }, [deal, quadrant.value, shuffle, swap, transform, wholeBoard]);

  const inHand = quadrant.value;
  const disabled = inHand == null;

  return (
    <div
      className={clsx(
        "grid grid-cols-[repeat(4,2.5rem)] h-fit place-content-center gap-1",
        "lg:grid-cols-[auto_1.5rem] lg:auto-rows-[2.5rem]",
        className,
      )}
    >
      <button
        type="button"
        className="flex items-center justify-center bg-transparent border-2 border-link rounded-2 text-4 text-text-1"
        aria-label="Rotate tile"
        disabled={disabled}
        onClick={() => inHand != null && transform(inHand, "rotate")}
      >
        <Icon icon={ArrowClockwise} />
      </button>

      <KeyHint>R</KeyHint>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent border-2 border-link rounded-2 text-4 text-text-1"
        aria-label="Mirror tile"
        disabled={disabled}
        onClick={() => inHand != null && transform(inHand, "flip")}
      >
        <Icon icon={FlipHorizontal} />
      </button>

      <KeyHint>F</KeyHint>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent border-2 border-link rounded-2 text-4 text-text-1"
        aria-label="Swap tile"
        disabled={disabled}
        onClick={() => inHand != null && swap(inHand)}
      >
        <Icon icon={Repeat} />
      </button>

      <KeyHint>X</KeyHint>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent border-2 border-link rounded-2 text-4 text-text-1"
        aria-label="Shuffle the tiles"
        onClick={shuffle}
      >
        <Icon icon={Shuffle} />
      </button>

      <KeyHint>S</KeyHint>
    </div>
  );
}

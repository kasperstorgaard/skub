import type { Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { useComposer } from "#/client/composer.ts";
import type { ComposerConfig, DealtTile } from "#/game/tiles.ts";
import type { Puzzle, TileEntry } from "#/game/types.ts";

type Props = {
  puzzle: Signal<Puzzle>;
  dealt: Signal<DealtTile[]>;
  config: Signal<ComposerConfig>;
  /** The quadrant in hand, picked on the board itself. */
  quadrant: Signal<number | null>;
  catalog: TileEntry[];
};

/**
 * The composer's keys, kept beside the editor's rather than inside the toolbar
 * that happens to draw the same actions as buttons.
 *
 * Shift widens each to the whole board, which is a dihedral transform — it
 * never changes what the board is worth solving.
 */
export function ComposerKeyboardShortcuts(
  { puzzle, dealt, config, quadrant, catalog }: Props,
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

  return null;
}

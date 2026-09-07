import type { Signal } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";

import { useEditor } from "#/client/editor.ts";
import type { CellContent, Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";

type Props = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  /** What the cell cycle offers, when it isn't the full set. */
  contents?: readonly CellContent[];
};

export function EditorKeyboardShortcuts({ puzzle, href, contents }: Props) {
  const active = useMemo(() => decodeState(href.value).active, [href.value]);
  const { cycleWall, cycleCell, setDestination } = useEditor({
    active,
    puzzle,
    contents,
  });

  // A tile has no destination to set, which is also what drops the puck.
  const hasDestination = !contents || contents.includes("puck");

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.isContentEditable || target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"
      ) return;
      switch (event.key) {
        case "w":
          return cycleWall();
        case "p":
          return cycleCell();
        case "d":
          return hasDestination ? setDestination() : undefined;
      }
    };

    if (active) self.addEventListener("keyup", onKeyUp);
    return () => self.removeEventListener("keyup", onKeyUp);
  }, [active, cycleWall, cycleCell, hasDestination, setDestination]);

  return null;
}

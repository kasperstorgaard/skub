import type { Signal } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";

import { useEditor } from "#/client/editor.ts";
import type { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";

type Props = { puzzle: Signal<Puzzle>; href: Signal<string> };

export function EditorKeyboardShortcuts({ puzzle, href }: Props) {
  const active = useMemo(() => decodeState(href.value).active, [href.value]);
  const { cycleWall, cycleCell, setDestination } = useEditor({
    active,
    puzzle,
  });

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
          return setDestination();
      }
    };

    if (active) self.addEventListener("keyup", onKeyUp);
    return () => self.removeEventListener("keyup", onKeyUp);
  }, [active, cycleWall, cycleCell, setDestination]);

  return null;
}

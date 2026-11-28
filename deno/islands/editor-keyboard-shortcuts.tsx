import type { Signal } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";

import { useEditor } from "#/client/editor.ts";
import type { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";

type Props = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  /** Whether the solution shows. Holding Shift turns it on until release. */
  showSolution: Signal<boolean>;
};

export function EditorKeyboardShortcuts(
  { puzzle, href, showSolution }: Props,
) {
  const active = useMemo(() => decodeState(href.value).active, [href.value]);
  const { cycleWall, toggleCorner, cycleCell, setDestination } = useEditor({
    active,
    puzzle,
  });

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (isTyping(event.target as HTMLElement)) return;
      switch (event.key) {
        case "w":
          return cycleWall();
        case "c":
          return toggleCorner();
        case "p":
          return cycleCell();
        case "d":
          return setDestination();
      }
    };

    if (active) self.addEventListener("keyup", onKeyUp);
    return () => self.removeEventListener("keyup", onKeyUp);
  }, [active, cycleWall, toggleCorner, cycleCell, setDestination]);

  useEffect(() => {
    // Only a hold that turned it on turns it off: the switch may have it on.
    let isHoldingShift = false;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Shift" || showSolution.value) return;
      if (isTyping(event.target as HTMLElement)) return;

      isHoldingShift = true;
      showSolution.value = true;
    };

    const release = (event: Event) => {
      if (!isHoldingShift) return;
      if (event instanceof KeyboardEvent && event.key !== "Shift") return;

      isHoldingShift = false;
      showSolution.value = false;
    };

    self.addEventListener("keydown", onKeyDown);
    self.addEventListener("keyup", release);
    // Alt-tabbing away mid-hold never delivers the keyup.
    self.addEventListener("blur", release);

    return () => {
      self.removeEventListener("keydown", onKeyDown);
      self.removeEventListener("keyup", release);
      self.removeEventListener("blur", release);
    };
  }, [showSolution]);

  return null;
}

// A clicked switch keeps focus, and it takes no text.
const isTyping = (target: HTMLElement) =>
  target.isContentEditable || target.tagName === "TEXTAREA" ||
  (target.tagName === "INPUT" &&
    (target as HTMLInputElement).type !== "checkbox");

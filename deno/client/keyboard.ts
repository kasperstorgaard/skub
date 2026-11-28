import { useEffect, useRef } from "preact/hooks";

import type { Direction } from "#/game/types.ts";

type UseArrowKeysOptions = {
  isEnabled?: boolean;
  onArrowKey: (direction: Direction) => void;
};

export function useArrowKeys(
  { isEnabled, onArrowKey }: UseArrowKeysOptions,
) {
  const onArrowKeyRef = useRef(onArrowKey);
  onArrowKeyRef.current = onArrowKey;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
          return onArrowKeyRef.current("up");
        case "ArrowRight":
          return onArrowKeyRef.current("right");
        case "ArrowDown":
          return onArrowKeyRef.current("down");
        case "ArrowLeft":
          return onArrowKeyRef.current("left");
      }
    };

    if (isEnabled) {
      globalThis.document.addEventListener("keyup", handler);
    }

    return () => {
      globalThis.document.removeEventListener("keyup", handler);
    };
  }, [isEnabled]);
}

type useGameShortcutsOptions = {
  onSubmit?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onReset?: () => void;
  onHint?: () => void;
};

/**
 * Registers keyboard shortcuts for in-game actions.
 * Keys:
 * - Enter → submit
 * - u → undo
 * - U → reset
 * - r → redo
 * - h -> hint
 *
 * Shortcuts are suppressed when focus is inside an input element.
 */
export function useGameShortcuts(
  { onSubmit, onUndo, onRedo, onReset, onHint }: useGameShortcutsOptions,
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // If the event originated from an input, let it do it's thing.
      const input = (event.target as HTMLElement).closest("input");
      if (input != null) return;

      switch (event.key) {
        case "Enter":
          return onSubmit?.();
        case "u":
          return onUndo?.();
        case "U":
          return onReset?.();
        case "r":
          return onRedo?.();
        case "h":
          return onHint?.();
      }
    };

    globalThis.document.addEventListener("keyup", handler);

    return () => {
      globalThis.document.removeEventListener("keyup", handler);
    };
  }, [onSubmit, onUndo, onRedo, onReset]);
}

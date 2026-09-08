import type { Signal } from "@preact/signals";
import { useSignalEffect } from "@preact/signals";
import { useRef } from "preact/hooks";

import { useDebouncedCallback } from "#/client/use-debounced-callback.ts";
import type { Puzzle } from "#/game/types.ts";

type Props = { puzzle: Signal<Puzzle> };

const DEBOUNCE_MS = 600;

/**
 * Keeps the tile draft in step with the board on screen. The puzzle-shaped
 * signal is what the editor components speak; only its board travels.
 */
export function TileAutosave({ puzzle }: Props) {
  const isLoaded = useRef(false);

  const save = useDebouncedCallback(async (value: Puzzle) => {
    // Skip the initial save
    if (!isLoaded.current) {
      isLoaded.current = true;
      return;
    }

    try {
      await fetch("/api/store-tile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: value.board, id: value.slug }),
      });
    } catch {
      // silently fail — autosave is best-effort
    }
  }, DEBOUNCE_MS);

  useSignalEffect(() => save(puzzle.value));

  return null;
}

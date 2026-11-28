import type { Signal } from "@preact/signals";
import { useSignalEffect } from "@preact/signals";
import { useRef } from "preact/hooks";

import { useDebouncedCallback } from "#/client/use-debounced-callback.ts";
import { formatPuzzle } from "#/game/formatter.ts";
import type { Puzzle } from "#/game/types.ts";

type Props = { puzzle: Signal<Puzzle> };

const DEBOUNCE_MS = 600;

export function EditorAutosave({ puzzle }: Props) {
  const isLoaded = useRef(false);

  const save = useDebouncedCallback(async (value: Puzzle) => {
    // Skip the initial save
    if (!isLoaded.current) {
      isLoaded.current = true;
      return;
    }

    let markdown: string;

    try {
      markdown = formatPuzzle(value);
    } catch {
      return;
    }

    try {
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
    } catch {
      // silently fail — autosave is best-effort
    }
  }, DEBOUNCE_MS);

  useSignalEffect(() => save(puzzle.value));

  return null;
}

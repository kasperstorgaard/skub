import { useCallback, useEffect, useRef } from "preact/hooks";

import type { SolverEvent } from "#/game/solver.ts";
import type { Board } from "#/game/types.ts";

/**
 * Streams solver events from POST /api/solve with proper cancellation.
 * Call `start(board)` to begin; any previous in-flight request is cancelled.
 * Cancels automatically on unmount.
 */
export function useSolveStream(
  onEvent: (event: SolverEvent) => void,
): { start: (board: Board) => void; cancel: () => void } {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const start = useCallback((board: Board) => {
    cancel();

    const controller = new AbortController();
    controllerRef.current = controller;

    (async () => {
      try {
        const response = await fetch("/api/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(board),
          signal: controller.signal,
        });

        if (!response.ok) {
          onEventRef.current({ type: "error", message: await response.text() });
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";

          for (const message of messages) {
            const line = message.split("\n").find((l) =>
              l.startsWith("data: ")
            );
            if (!line) continue;
            onEventRef.current(JSON.parse(line.slice(6)) as SolverEvent);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          onEventRef.current({
            type: "error",
            message: err instanceof Error ? err.message : "Solve failed",
          });
        }
      }
    })();
  }, [cancel]);

  useEffect(() => () => cancel(), []);

  return { start, cancel };
}

import { useCallback, useEffect, useRef } from "preact/hooks";

import type { GenerateEvent, GenerateRequest } from "#/game/generate-worker.ts";

/** Options the caller supplies; corpus + budget are filled in server-side. */
export type GenerateStreamOptions = Omit<
  GenerateRequest,
  "corpus" | "maxGateAttempts"
>;

/**
 * Streams gated-generation events from POST /api/generate with cancellation.
 * Call `start(options)` to begin; any previous in-flight run is cancelled.
 * Cancels automatically on unmount. Mirrors {@link useSolveStream}.
 */
export function useGenerateStream(
  onEvent: (event: GenerateEvent) => void,
): { start: (options: GenerateStreamOptions) => void; cancel: () => void } {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const start = useCallback((options: GenerateStreamOptions) => {
    cancel();

    const controller = new AbortController();
    controllerRef.current = controller;

    (async () => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
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
            onEventRef.current(JSON.parse(line.slice(6)) as GenerateEvent);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          onEventRef.current({
            type: "error",
            message: err instanceof Error ? err.message : "Generation failed",
          });
        }
      }
    })();
  }, [cancel]);

  useEffect(() => () => cancel(), []);

  return { start, cancel };
}

import { type Signal } from "@preact/signals";
import { useCallback } from "preact/hooks";

import { Icon, Star } from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { formatPuzzle } from "#/game/formatter.ts";
import type { Puzzle } from "#/game/types.ts";
import { useRouter } from "#/islands/router.tsx";

type EditorPanelProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  isDev: boolean;
};

/**
 * Side panel for the puzzle editor. Locally it holds Review, which files the
 * board as a candidate to be analysed and rated; the corpus write lives behind
 * Promote. Sending it in is the nudge under the toolbar.
 */
export function EditorPanel(
  { puzzle, href, isDev }: EditorPanelProps,
) {
  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  // Keeps the shared href in step with client-side navigations.
  useRouter({ onLocationUpdated });

  // Autosave is debounced and a navigation cancels the request in flight, so
  // Review stores the board on screen first. The href works with JS off too.
  const onReview = useCallback(async (e: Event) => {
    e.preventDefault();
    try {
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: formatPuzzle(puzzle.value) }),
      });
    } catch {
      // Fall through: the draft in KV is the next best thing.
    }
    globalThis.location.href = "/candidates/review";
  }, []);

  return (
    <Panel hideBuilder>
      {isDev && (
        <div className="flex flex-col col-[2/3] lg:row-[3/4]">
          <a href="/candidates/review" className="btn" onClick={onReview}>
            <Icon icon={Star} /> Review
          </a>
        </div>
      )}
    </Panel>
  );
}

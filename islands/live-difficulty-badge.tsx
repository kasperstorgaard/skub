import type { Signal } from "@preact/signals";

import { DifficultyBadge } from "#/components/difficulty-badge.tsx";
import type { Puzzle } from "#/game/types.ts";

type LiveDifficultyBadgeProps = {
  puzzle: Signal<Puzzle>;
  className?: string;
};

/**
 * The badge for pages whose puzzle changes under it — generation swaps in a new
 * candidate without reloading, and route-level markup never re-renders. Pages
 * that solve server-side and hand over a finished puzzle use the plain
 * component instead and ship no JS.
 */
export function LiveDifficultyBadge(
  { puzzle, className }: LiveDifficultyBadgeProps,
) {
  return <DifficultyBadge puzzle={puzzle.value} className={className} />;
}

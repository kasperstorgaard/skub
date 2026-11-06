import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { flashExplained } from "#/client/flash-signals.ts";
import { Icon, LightningFill } from "#/components/icons.tsx";
import { isStuck } from "#/game/flash.ts";
import type { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";

type FlashNudgeProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  className?: string;
};

/**
 * Offers Flash once a player looks stuck, in the tutorial nudge's spot. Counts
 * moves and times back (undo, starting over) as the URL changes, so it only
 * shows with JS; the badge is the way in without it.
 */
export function FlashNudge({ puzzle, href, className }: FlashNudgeProps) {
  const play = useRef({ moves: 0, reversals: 0, cursor: 0 });
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    const state = decodeState(href.value);
    const cursor = state.cursor ?? state.moves.length;
    const previous = play.current.cursor;

    if (cursor > previous) play.current.moves += cursor - previous;
    if (cursor < previous) play.current.reversals += 1;
    play.current.cursor = cursor;

    if (isStuck(play.current, puzzle.value.minMoves)) setIsShown(true);
  }, [href.value]);

  const dialogHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.set("dialog", "flash");
    return url.href;
  }, [href.value]);

  if (!isShown || flashExplained.value) return null;

  return (
    <aside
      className={clsx(
        "grid justify-items-center gap-fl-1 py-2 w-full",
        "text-text-2 text-pretty",
        "animate-fade-in",
        className,
      )}
    >
      <p className="min-w-[16ch] text-center text-balance leading-snug">
        In a rush, or stuck?
      </p>

      <a href={dialogHref} className="btn min-w-action" data-router>
        <Icon icon={LightningFill} />
        Try Flash mode
      </a>
    </aside>
  );
}

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
        "flex flex-col place-content-center p-2 px-3",
        "animate-fade-in",
        className,
      )}
    >
      <a href={dialogHref} className="btn" data-router>
        <Icon icon={LightningFill} />
        In a rush? Try Flash mode
      </a>
    </aside>
  );
}

import type { Signal } from "@preact/signals";
import { useMemo, useState } from "preact/hooks";

import { Icon, LightningFill, Spinner } from "#/components/icons.tsx";
import { getHeadStartLength } from "#/game/flash.ts";
import type { Puzzle } from "#/game/types.ts";
import { getFlashHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";

type FlashDialogProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  /** Flash is already on, so there's nothing to explain. */
  isOn: boolean;
};

/** Explains Flash before it's turned on. Accepting posts to the Flash route. */
export function FlashDialog({ puzzle, href, isOn }: FlashDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const headStart = getHeadStartLength(puzzle.value.minMoves);

  const open = useMemo(
    () =>
      !isOn && headStart > 0 &&
      new URL(href.value).searchParams.get("dialog") === "flash",
    [href.value, isOn, headStart],
  );

  const closeHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.delete("dialog");
    return url.href;
  }, [href.value]);

  return (
    <Dialog open={open}>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-4 text-text-1 font-semibold leading-tight">
          Flash
        </h2>

        <p className="leading-snug">
          The puzzle starts over with the first{" "}
          {headStart === 1 ? "move" : `${headStart} moves`}{" "}
          of a shortest solution already played. They're locked in, so it's like
          taking {headStart === 1 ? "a hint" : `${headStart} hints`} at once.
        </p>

        <p className="leading-snug">
          Flash solves stay off the leaderboard, and Flash stays on for this
          puzzle for 24 hours.
        </p>
      </div>

      <form
        method="post"
        action={getFlashHref(href.value)}
        className="flex items-center gap-fl-2"
        onSubmit={() => setIsSubmitting(true)}
      >
        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting
            ? <Icon icon={Spinner} className="animate-spin" />
            : <Icon icon={LightningFill} />}
          Turn on Flash
        </button>

        <a
          href={closeHref}
          className="link p-0 bg-transparent"
          data-router="replace"
        >
          Not now
        </a>
      </form>
    </Dialog>
  );
}

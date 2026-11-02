import type { Signal } from "@preact/signals";
import { useMemo, useState } from "preact/hooks";

import { Icon, LightningFill, Spinner } from "#/components/icons.tsx";
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
  const flashStartLength = puzzle.value.flashStart?.length ?? 0;

  const open = useMemo(
    () =>
      !isOn && flashStartLength > 0 &&
      new URL(href.value).searchParams.get("dialog") === "flash",
    [href.value, isOn, flashStartLength],
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
          In a rush, or not really getting anywhere?<br />
          Flash mode gives you a shorter version of this puzzle, but skips the
          leaderboard.
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
          Turn on Flash mode
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

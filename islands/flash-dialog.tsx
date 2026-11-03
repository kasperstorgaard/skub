import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useMemo, useState } from "preact/hooks";

import { flashExplained } from "#/client/flash-signals.ts";
import { Icon, LightningFill, Spinner } from "#/components/icons.tsx";
import type { Puzzle } from "#/game/types.ts";
import { getFlashHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { useRouter } from "#/islands/router.tsx";

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

  const { updateLocation } = useRouter();

  // Answers in the background and closes, so the board stays as it is.
  const onNotNow = async (event: MouseEvent) => {
    event.preventDefault();
    flashExplained.value = true;

    const url = new URL(href.value);
    url.searchParams.delete("dialog");
    updateLocation(url.href, { replace: true });

    const body = new FormData();
    body.set("answer", "not-now");
    try {
      await fetch(getFlashHref(href.value), {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
    } catch {
      // The nudge is gone for this page view either way.
    }
  };

  return (
    <Dialog open={open}>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-fl-2 font-semibold text-text-1">Flash mode</h2>

        <p>
          Flash mode gives you a shorter version of this puzzle, but skips the
          leaderboard.
        </p>
      </div>

      <form
        method="post"
        action={getFlashHref(href.value)}
        className="flex gap-fl-2 justify-between flex-wrap w-full max-md:flex-col-reverse"
        onSubmit={() => setIsSubmitting(true)}
      >
        {/* Keeps the game as it was when JS is off. */}
        <input type="hidden" name="search" value={new URL(href.value).search} />

        <button
          type="submit"
          name="answer"
          value="not-now"
          className={clsx(
            "link flex items-center bg-transparent p-0 text-text-2 cursor-pointer",
            "max-md:justify-center",
          )}
          onClick={onNotNow}
        >
          Not now
        </button>

        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting
            ? <Icon icon={Spinner} className="animate-spin" />
            : <Icon icon={LightningFill} />}
          Try it
        </button>
      </form>
    </Dialog>
  );
}

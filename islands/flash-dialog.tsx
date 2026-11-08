import type { Signal } from "@preact/signals";
import { useMemo, useState } from "preact/hooks";

import { flashExplained } from "#/client/flash-signals.ts";
import { DialogActions, DISMISS } from "#/components/dialog-actions.tsx";
import { Icon, LightningFill, Spinner } from "#/components/icons.tsx";
import type { Puzzle } from "#/game/types.ts";
import { getFlashHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { useRouter } from "#/islands/router.tsx";

type FlashDialogProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  /** Flash is already on: the dialog explains it, with nothing to answer. */
  isOn: boolean;
};

/**
 * Explains Flash: before it's turned on, where accepting posts to the Flash
 * route, and again while it's on.
 */
export function FlashDialog({ puzzle, href, isOn }: FlashDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const flashStartLength = puzzle.value.flashStart?.length ?? 0;

  const open = useMemo(
    () =>
      flashStartLength > 0 &&
      new URL(href.value).searchParams.get("dialog") === "flash",
    [href.value, isOn, flashStartLength],
  );

  const { updateLocation } = useRouter();

  const closeHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.delete("dialog");
    return url.href;
  }, [href.value]);

  // Answers in the background and closes, so the board stays as it is.
  const onNotNow = async (event: MouseEvent) => {
    event.preventDefault();
    flashExplained.value = true;

    updateLocation(closeHref, { replace: true });

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
          Same board, shorter puzzle, fewer stars.
          <br />
          (Stays on for this puzzle today)
        </p>
      </div>

      {isOn
        ? (
          <DialogActions>
            <a
              href={closeHref}
              className="btn"
              onClick={(event) => {
                event.preventDefault();
                updateLocation(closeHref);
              }}
            >
              Got it
            </a>
          </DialogActions>
        )
        : (
          <form
            method="post"
            action={getFlashHref(href.value)}
            className="w-full"
            onSubmit={() => setIsSubmitting(true)}
          >
            {/* Keeps the game as it was when JS is off. */}
            <input
              type="hidden"
              name="search"
              value={new URL(href.value).search}
            />

            <DialogActions
              dismiss={
                <button
                  type="submit"
                  name="answer"
                  value="not-now"
                  className={DISMISS}
                  onClick={onNotNow}
                >
                  Not now
                </button>
              }
            >
              <button type="submit" className="btn" disabled={isSubmitting}>
                {isSubmitting
                  ? <Icon icon={Spinner} className="animate-spin" />
                  : <Icon icon={LightningFill} />}
                Try it
              </button>
            </DialogActions>
          </form>
        )}
    </Dialog>
  );
}

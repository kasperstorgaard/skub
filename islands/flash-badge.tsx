import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useMemo } from "preact/hooks";

import { flashExplained } from "#/client/flash-signals.ts";
import { LightningFill } from "#/components/icons.tsx";
import type { Puzzle } from "#/game/types.ts";
import { getFlashHref } from "#/game/url.ts";

type FlashBadgeProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  isOn: boolean;
  /** The Flash dialog was answered before, so the switch skips it. */
  isExplained: boolean;
  /** Hide the move count when the user hasn't solved this puzzle before. */
  hideMinMoves?: boolean;
  className?: string;
};

/**
 * The puzzle page's `DifficultyBadge`, with the Flash switch in place of the
 * difficulty label. Off, it opens the Flash dialog the first time and turns
 * Flash on after that; on, it stays on for the day and the badge turns pearl.
 */
export function FlashBadge(
  { puzzle, href, isOn, isExplained, hideMinMoves, className }: FlashBadgeProps,
) {
  const skipsDialog = isExplained || flashExplained.value;

  const dialogHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.set("dialog", "flash");
    return url.href;
  }, [href.value]);

  return (
    <span
      className={clsx(
        "difficulty-badge relative flex items-stretch overflow-hidden",
        "leading-loose text-2 tracking-wider",
        isOn && "bg-surface-1",
        !isOn && "bg-surface-2",
        className,
      )}
    >
      {isOn
        ? (
          <span
            role="switch"
            aria-checked="true"
            aria-disabled="true"
            aria-label="Flash"
            title="Flash mode: activated"
            className="grid place-items-center min-w-[2.25rem] px-2"
          >
            <PearlBolt />
          </span>
        )
        : skipsDialog
        ? (
          <form
            method="post"
            action={getFlashHref(href.value)}
            className="contents"
          >
            <OffSwitch as="button" type="submit" />
          </form>
        )
        : <OffSwitch as="a" href={dialogHref} data-router />}

      <span
        className={clsx(
          "grid place-items-center px-2 min-w-[3ch] text-center cursor-help",
          !isOn && "bg-surface-3",
        )}
        title={hideMinMoves
          ? "solve the puzzle to reveal"
          : "shortest possible solution"}
      >
        {hideMinMoves ? "?" : puzzle.value.minMoves || "—"}
      </span>

      {
        // On: a pearl ring inside the badge's edge, so it keeps its size and
        // nothing is filled
        isOn && (
          <span
            aria-hidden="true"
            className={clsx(
              "absolute inset-0 p-[2px] pointer-events-none",
              "bg-(image:--pearl)",
              "[mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)]",
            )}
          />
        )
      }
    </span>
  );
}

type OffSwitchProps =
  | { as: "a"; href: string; "data-router": true }
  | { as: "button"; type: "submit" };

/** The switch while Flash is off: a link to the dialog, or straight on. */
function OffSwitch({ as: Element, ...props }: OffSwitchProps) {
  return (
    <Element
      {...props}
      role="switch"
      aria-checked="false"
      aria-label="Flash"
      title="Flash: start a few moves in, off the leaderboard"
      className={clsx(
        "grid place-items-center min-w-[2.25rem] px-2",
        "bg-transparent no-underline cursor-pointer",
        "hover:brightness-125",
      )}
    >
      <PearlBolt />
    </Element>
  );
}

// The filled bolt as a mask, so the badge's pearl shows through its shape.
const BOLT_MASK = `url("data:image/svg+xml,${
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${LightningFill}</svg>`,
  )
}")`;

/** A bolt filled with the pearl; turning Flash on fills the cell instead. */
function PearlBolt() {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-block size-[1em] bg-(image:--pearl)",
        "[mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]",
      )}
      style={{ maskImage: BOLT_MASK, WebkitMaskImage: BOLT_MASK }}
    />
  );
}

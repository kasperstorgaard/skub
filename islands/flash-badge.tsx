import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useMemo } from "preact/hooks";

import { Icon, Lightning, LightningFill } from "#/components/icons.tsx";
import type { Puzzle } from "#/game/types.ts";

type FlashBadgeProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  isOn: boolean;
  /** Hide the move count when the user hasn't solved this puzzle before. */
  hideMinMoves?: boolean;
  className?: string;
};

/**
 * The puzzle page's `DifficultyBadge`, with the Flash switch in place of the
 * difficulty label. Off, it opens the Flash dialog; on, it stays on for the day
 * and the badge turns pearl.
 */
export function FlashBadge(
  { puzzle, href, isOn, hideMinMoves, className }: FlashBadgeProps,
) {
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
        "[--pearl:radial-gradient(ellipse_at_25%_10%,rgb(255_255_255/0.5),transparent_55%),linear-gradient(115deg,var(--color-brand),var(--color-link)_45%,var(--color-brand)_75%,var(--color-link))]",
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
            className={clsx(
              "grid place-items-center min-w-[2.25rem] px-2",
              "bg-(image:--pearl) text-(--btn-active-text)",
              "shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]",
            )}
          >
            <Icon icon={LightningFill} />
          </span>
        )
        : (
          <a
            href={dialogHref}
            role="switch"
            aria-checked="false"
            aria-label="Flash"
            title="Flash: start a few moves in, off the leaderboard"
            data-router
            className={clsx(
              "grid place-items-center min-w-[2.25rem] px-2",
              "text-text-2 no-underline",
              "hover:text-text-1",
            )}
          >
            <Icon icon={Lightning} />
          </a>
        )}

      <span
        className={clsx(
          "grid place-items-center px-2 min-w-[3ch] text-center cursor-help",
          !isOn && "bg-surface-3",
          // A pearl border around the count, which is pearl too.
          isOn && "border-2 border-transparent",
          isOn &&
            "[background:linear-gradient(var(--color-surface-1),var(--color-surface-1))_padding-box,var(--pearl)_border-box]",
        )}
        title={hideMinMoves
          ? "solve the puzzle to reveal"
          : "shortest possible solution"}
      >
        <span
          className={clsx(
            isOn && "bg-(image:--pearl) bg-clip-text text-transparent",
            isOn && "font-bold",
          )}
        >
          {hideMinMoves ? "?" : puzzle.value.minMoves || "—"}
        </span>
      </span>
    </span>
  );
}

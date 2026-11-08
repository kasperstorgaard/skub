import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useMemo } from "preact/hooks";

import { flashExplained } from "#/client/flash-signals.ts";
import { Icon, LightningFill } from "#/components/icons.tsx";
import { getFlashHref } from "#/game/url.ts";

type FlashSwitchProps = {
  href: Signal<string>;
  isOn: boolean;
  /** The Flash dialog was answered before, so the switch skips it. */
  isExplained: boolean;
  /** The toolbar's button classes. */
  className: string;
  iconClassName: string;
};

/**
 * The Flash tool. Off, it opens the Flash dialog the first time and turns
 * Flash on after that; on, it stays on for the day, lit in the pearl, and
 * opens the dialog again to explain it.
 */
export function FlashSwitch(
  { href, isOn, isExplained, className, iconClassName }: FlashSwitchProps,
) {
  const skipsDialog = isExplained || flashExplained.value;

  const dialogHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.set("dialog", "flash");
    return url.href;
  }, [href.value]);

  if (isOn) {
    return (
      <a
        href={dialogHref}
        data-router
        aria-label="Flash mode: on"
        title="Flash mode: on for this puzzle today"
        className={clsx(
          className,
          "cursor-pointer",
          // On: faint pearl fill, slow glow
          "bg-(image:--pearl-border-faint) border-transparent text-text-1",
          "motion-safe:flash-pulse",
        )}
      >
        <Icon icon={LightningFill} className={iconClassName} />
      </a>
    );
  }

  const props = {
    role: "switch",
    "aria-checked": "false",
    "aria-label": "Flash",
    title: "Flash mode: same board, shorter puzzle, fewer stars",
    className: clsx(className, "cursor-pointer"),
  } as const;
  const icon = <Icon icon={LightningFill} className={iconClassName} />;

  return skipsDialog
    ? (
      <form
        method="post"
        action={getFlashHref(href.value)}
        className="contents"
      >
        <button type="submit" {...props}>{icon}</button>
      </form>
    )
    : <a href={dialogHref} data-router {...props}>{icon}</a>;
}

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
 * Flash on after that; on, it stays on for the day, its bolt in the pearl.
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
      <span
        role="switch"
        aria-checked="true"
        // Read-only, not disabled: disabled tools fade, and this one is lit
        aria-readonly="true"
        aria-label="Flash"
        title="Flash mode: activated"
        className={className}
      >
        <PearlBolt className={iconClassName} />
      </span>
    );
  }

  const props = {
    role: "switch",
    "aria-checked": "false",
    "aria-label": "Flash",
    title: "Flash mode: same board, shorter puzzle, smaller prizes",
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

// The filled bolt as a mask, so the pearl shows through its shape.
const BOLT_MASK = `url("data:image/svg+xml,${
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${LightningFill}</svg>`,
  )
}")`;

/** A bolt filled with the pearl. */
function PearlBolt({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={className}>
      <span
        className={clsx(
          "block size-[1em] bg-(image:--pearl)",
          "[mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]",
        )}
        style={{ maskImage: BOLT_MASK, WebkitMaskImage: BOLT_MASK }}
      />
    </span>
  );
}

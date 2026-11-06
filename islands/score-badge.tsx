import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useMemo } from "preact/hooks";

import { flashExplained } from "#/client/flash-signals.ts";
import { Icon, LightningFill } from "#/components/icons.tsx";
import type { Puzzle } from "#/game/types.ts";
import { getFlashHref } from "#/game/url.ts";
import { MoveScore } from "#/islands/move-score.tsx";

type ScoreBadgeProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  /** The Flash switch, for puzzles that have a Flash start. */
  flash?: {
    isOn: boolean;
    /** The Flash dialog was answered before, so the switch skips it. */
    isExplained: boolean;
  };
  /** A fixed count instead of the URL's moves, see `MoveScore` */
  moves?: number | null;
  /** Hide the shortest solution when the user hasn't solved this puzzle. */
  hideMinMoves?: boolean;
  className?: string;
};

/**
 * While playing: moves played over the shortest solution, behind the Flash
 * switch when the puzzle has one. Off, the switch opens the Flash dialog the
 * first time and turns Flash on after that; on, it stays on for the day and
 * the badge turns pearl.
 */
export function ScoreBadge(
  { puzzle, href, flash, moves, hideMinMoves, className }: ScoreBadgeProps,
) {
  const isOn = flash?.isOn ?? false;
  const skipsDialog = flash?.isExplained || flashExplained.value;

  const dialogHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.set("dialog", "flash");
    return url.href;
  }, [href.value]);

  return (
    <span
      className={clsx(
        "difficulty-badge relative flex items-stretch overflow-hidden rounded-2",
        "leading-loose text-4 lg:text-3 tracking-wider",
        "bg-raised-1",
        className,
      )}
    >
      {!flash ? null : isOn
        ? (
          <span
            role="switch"
            aria-checked="true"
            aria-disabled="true"
            aria-label="Flash"
            title="Flash mode: activated"
            className="grid place-items-center w-[2em]"
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
          // 71px at the badge's 20px text, scaling with it
          "grid place-items-center px-2 min-w-[3.55em] text-center cursor-help",
          "bg-raised-2",
        )}
        title={hideMinMoves
          ? "moves played / solve the puzzle to reveal the shortest"
          : "moves played / shortest possible solution"}
      >
        <MoveScore
          href={href}
          moves={moves}
          minMoves={puzzle.value.minMoves}
          hideMinMoves={hideMinMoves}
        />
      </span>
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
      title="Flash mode: same board, shorter puzzle, smaller prizes"
      className={clsx(
        // Square: the badge is leading-loose, 2em tall; aspect-ratio can't see
        // a flex item's stretched height. Links get their own font-size from
        // the base styles, so take the badge's for the em to match.
        "grid place-items-center w-[2em] [font-size:inherit]",
        "bg-transparent no-underline cursor-pointer text-text-3",
        "hover:text-text-2",
      )}
    >
      {/* Off: a grey bolt; on, it fills with the pearl */}
      <Icon icon={LightningFill} />
    </Element>
  );
}

// The filled bolt as a mask, so the badge's pearl shows through its shape.
const BOLT_MASK = `url("data:image/svg+xml,${
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${LightningFill}</svg>`,
  )
}")`;

/** A bolt filled with the pearl. */
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

import { clsx } from "clsx/lite";

import { getPuzzleDate, getPuzzleNumber, type SlotRange } from "#/game/date.ts";

type ArchiveMinimapProps = {
  bounds: SlotRange;
  /** The day centred without JS. */
  current: number;
};

/**
 * The whole archive scaled down to a tick per day, months labelled, sliding
 * under a fixed indicator as the row scrolls. Months are links without JS.
 */
export function ArchiveMinimap({ bounds, current }: ArchiveMinimapProps) {
  const days = bounds.to - bounds.from + 1;

  return (
    <nav
      id="archive-minimap"
      aria-label="Months"
      className={clsx(
        "@container relative h-10 overflow-hidden cursor-pointer select-none",
        "[mask-image:linear-gradient(to_right,transparent,black_25%,black_75%,transparent)]",
      )}
    >
      <div
        data-minimap-track
        style={{
          "--days": days,
          width: `calc(var(--d) * ${days})`,
          translate: `calc(50cqw - var(--d) * ${current - bounds.from + 0.5})`,
        }}
        className={clsx(
          "absolute inset-y-0 left-0",
          "[--d:6px]",
          "[--minimap-from:calc(50cqw_-_var(--d)_*_var(--cards)_/_2)]",
          "[--minimap-to:calc(50cqw_-_var(--d)_*_(var(--days)_-_var(--cards)_/_2))]",
          // Follows the row's scroll on the compositor; JS covers the rest
          "js:supports-[animation-timeline:scroll()]:[animation-name:minimap]",
          "js:supports-[animation-timeline:scroll()]:[animation-timing-function:linear]",
          "js:supports-[animation-timeline:scroll()]:[animation-fill-mode:both]",
          "js:supports-[animation-timeline:scroll()]:[animation-timeline:--archive-row]",
          "bg-[repeating-linear-gradient(to_right,var(--color-surface-3)_0_1px,transparent_1px_var(--d))] bg-[length:100%_0.5rem] bg-bottom bg-no-repeat",
        )}
      >
        {getMonthStarts(bounds).map(({ number, label, date }) => (
          <a
            key={number}
            href={`?date=${date}#${date}`}
            data-number={number}
            style={{ left: `calc(var(--d) * ${number - bounds.from})` }}
            className={clsx(
              "absolute bottom-0 h-full pl-1 pt-1",
              "border-l border-text-3",
              "text-1 text-text-2 no-underline whitespace-nowrap hover:text-text-1",
            )}
          >
            {label}
          </a>
        ))}
      </div>

      {/* The day centred in the row */}
      <span
        aria-hidden="true"
        className={clsx(
          "absolute bottom-0 left-1/2 -translate-x-1/2",
          "border-x-6 border-x-transparent border-b-8 border-b-brand",
        )}
      />
    </nav>
  );
}

/** Each month's first slot within the bounds, labelled; years on January. */
function getMonthStarts(bounds: SlotRange) {
  const first = getPuzzleDate(bounds.from);
  const last = getPuzzleDate(bounds.to);
  const starts = [];

  for (
    let month = first.with({ day: 1 });
    Temporal.PlainDate.compare(month, last) <= 0;
    month = month.add({ months: 1 })
  ) {
    const date = Temporal.PlainDate.compare(month, first) < 0 ? first : month;
    const label = date.toLocaleString(undefined, {
      month: "short",
      year: date.month === 1 ? "numeric" : undefined,
    });
    starts.push({
      number: getPuzzleNumber(date),
      label,
      date: date.toString(),
    });
  }

  return starts;
}

import { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { getArchiveDate } from "#/game/url.ts";

type MonthStripProps = {
  href: string;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type Props = {
  href: Signal<string>;
  today: Temporal.PlainDate;
  selectedDate: Temporal.PlainDate;
};

export function MonthStrip({ href, today, selectedDate }: Props) {
  return (
    <div className="flex max-sm:overflow-x-auto -mx-1 px-1 -my-1 py-1">
      <nav
        aria-label="Months with puzzles"
        className="grid max-sm:grid-flow-col sm:grid-cols-6 gap-1"
      >
        {MONTH_LABELS.map((label, idx) => {
          const month = idx + 1;
          const isFuture = month > today.month;

          if (isFuture) return null;

          const isActive = selectedDate.month === idx + 1;

          return (
            <a
              key={label}
              href={buildMonthHref(href.value, selectedDate, idx + 1)}
              aria-current={isActive || undefined}
              autoFocus={isActive}
              className={clsx(
                "px-3 py-2",
                "no-underline whitespace-nowrap max-sm:text-2 text-1 border-1 transition-colors",
                "first:rounded-l-2 last:rounded-r-2",
                "not-first:-ml-px",
                isActive
                  ? "relative z-10 bg-link text-surface-1 border-link hover:brigthness-(--hover-brightness)"
                  : "text-text-1 border-surface-2 hover:bg-surface-2",
              )}
            >
              {label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

function buildMonthHref(
  href: string,
  selectedDate: Temporal.PlainDate,
  month: number,
) {
  const url = new URL(href);

  const date = new Temporal.PlainDate(selectedDate.year, month, 1);

  url.searchParams.set("date", date.toString());

  return url.href;
}

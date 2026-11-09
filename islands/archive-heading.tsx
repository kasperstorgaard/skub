import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useEffect, useRef } from "preact/hooks";

import { attachArchiveScroller } from "#/client/archive-scroller.ts";
import { CaretLeft, CaretRight, Icon } from "#/components/icons.tsx";
import type { SlotRange } from "#/game/date.ts";

export type ArchiveHeadingDay = {
  date: string;
  /** "Monday" */
  weekday: string;
  month: string;
  year: number;
};

export type ArchiveMonth = {
  /** "2026-11" */
  key: string;
  /** "November" */
  name: string;
  /** Its first slot within the archive. */
  number: number;
  date: string;
};

type Props = {
  bounds: SlotRange;
  range: SlotRange;
  current: number;
  /** The centred day, until the row scrolls. */
  day: ArchiveHeadingDay;
  months: ArchiveMonth[];
};

/**
 * The page's title: the centred day's month with its year leading in, then
 * the day between the month links. On mobile it also drives the row below,
 * by id: the row's DOM stays the server's.
 */
export function ArchiveHeading(
  { bounds, range, current, day: initial, months }: Props,
) {
  const day = useSignal(initial);

  // A client navigation brings a new day
  useEffect(() => {
    day.value = initial;
  }, [initial.date]);
  const scroller = useRef<ReturnType<typeof attachArchiveScroller>>();

  useEffect(() => {
    // Desktop keeps the calendar
    if (matchMedia("(min-width: 64rem)").matches) return;
    const row = document.getElementById("archive-row");
    if (!row) return;

    scroller.current = attachArchiveScroller({
      row,
      bounds,
      range,
      current,
      onCentre: (card) => {
        if (card.id === day.value.date) return;
        day.value = {
          date: card.id,
          weekday: card.dataset.weekday ?? "",
          month: card.dataset.month ?? "",
          year: Number(card.dataset.year),
        };
      },
    });
    return () => scroller.current?.detach();
  }, []);

  const dayOfMonth = Number(day.value.date.slice(8));
  const index = months.findIndex(({ key }) =>
    key === day.value.date.slice(0, 7)
  );

  function onMonthClick(event: MouseEvent, month: ArchiveMonth) {
    if (!scroller.current) return;
    event.preventDefault();
    scroller.current.scrollToSlot(month.number);
  }

  return (
    <div className="grid gap-fl-2">
      {/* The month is the page's title; the year leads in */}
      <hgroup className="flex flex-col">
        <p className="text-3 tabular-nums text-text-2">
          {day.value.year}
        </p>
        {/* Desktop's title carries the date; mobile's day is below */}
        <h1 className="text-brand text-7 leading-flat">
          {day.value.month}
          <span className="max-lg:hidden ml-[0.25em]">{dayOfMonth}</span>
        </h1>
      </hgroup>

      {/* The day stays centred, with or without a link either side */}
      <nav
        aria-label="Months"
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-fl-2"
      >
        <MonthLink
          month={months[index - 1]}
          direction="previous"
          onClick={onMonthClick}
        />
        <p className="text-4 font-3 leading-flat text-text-2">
          {day.value.weekday}
          <span className="lg:hidden ml-[0.25em]">{dayOfMonth}</span>
        </p>
        <MonthLink
          month={months[index + 1]}
          direction="next"
          onClick={onMonthClick}
        />
      </nav>
    </div>
  );
}

type MonthLinkProps = {
  month?: ArchiveMonth;
  direction: "previous" | "next";
  onClick: (event: MouseEvent, month: ArchiveMonth) => void;
};

function MonthLink({ month, direction, onClick }: MonthLinkProps) {
  // Keeps the next month on the right when there's no previous one
  if (!month) return <span />;

  const isPrevious = direction === "previous";

  return (
    <a
      href={`?date=${month.date}#${month.date}`}
      aria-label={`${isPrevious ? "Previous" : "Next"} month, ${month.name}`}
      className={clsx(
        "flex items-center gap-1",
        isPrevious ? "justify-self-start" : "justify-self-end",
        "text-3 text-link no-underline hover:underline",
      )}
      onClick={(event) => onClick(event, month)}
    >
      {isPrevious && <Icon icon={CaretLeft} />}
      {month.name}
      {!isPrevious && <Icon icon={CaretRight} />}
    </a>
  );
}

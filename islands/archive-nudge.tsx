import { centredSlot, goToSlot } from "#/client/archive-signals.ts";

type Props = {
  /** Days with a puzzle the player hasn't solved, oldest first. */
  unplayed: { number: number; date: string }[];
  /** The landing day, until the row reports its centre. */
  current: number;
};

/**
 * Under the archive row, in the puzzle page's nudge spot: the nearest puzzle
 * the player hasn't solved. Back through the archive first, the way it's
 * usually played; newer only once there's none older.
 */
export function ArchiveNudge({ unplayed, current }: Props) {
  const slot = centredSlot.value ?? current;
  const target = unplayed.findLast(({ number }) => number < slot) ??
    unplayed.find(({ number }) => number > slot);

  if (!target) return null;

  function onClick(event: MouseEvent) {
    const goTo = goToSlot.value;
    if (!goTo || !target) return;
    event.preventDefault();
    goTo(target.number);
  }

  return (
    <aside className="flex flex-col place-content-center gap-2 p-2 px-3 text-text-2 text-pretty">
      <p className="text-center leading-snug">Missed one?</p>
      <a
        href={`?date=${target.date}#${target.date}`}
        className="btn"
        onClick={onClick}
      >
        Catch up
      </a>
    </aside>
  );
}

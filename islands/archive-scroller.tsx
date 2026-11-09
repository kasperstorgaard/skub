import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { attachArchiveScroller } from "#/client/archive-scroller.ts";
import type { SlotRange } from "#/game/date.ts";

type Props = {
  bounds: SlotRange;
  range: SlotRange;
  current: number;
  /** The month of the centred day, until the row scrolls. */
  month: string;
};

/**
 * The month of the centred day. Also drives the row it sits above, by id:
 * its DOM stays the server's.
 */
export function ArchiveScroller({ bounds, range, current, month }: Props) {
  const label = useSignal(month);

  useEffect(() => {
    const row = document.getElementById("archive-row");
    if (!row) return;

    return attachArchiveScroller({
      row,
      bounds,
      range,
      current,
      onMonth: (value) => label.value = value,
    });
  }, []);

  return <p className="type-meta text-text-2">{label}</p>;
}

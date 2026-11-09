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
 * The month of the centred day. Also drives the row and minimap it sits
 * above, by id: their DOM stays the server's.
 */
export function ArchiveScroller({ bounds, range, current, month }: Props) {
  const label = useSignal(month);

  useEffect(() => {
    const row = document.getElementById("archive-row");
    const minimap = document.getElementById("archive-minimap");
    if (!row || !minimap) return;

    return attachArchiveScroller({
      row,
      minimap,
      bounds,
      range,
      current,
      onMonth: (value) => label.value = value,
    });
  }, []);

  return <p className="type-meta text-text-2 text-center">{label}</p>;
}

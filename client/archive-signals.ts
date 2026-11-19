import { signal } from "@preact/signals";

/**
 * The archive row's centred slot, shared by the islands around the row. Null
 * until the row attaches; the server's `current` stands in until then.
 */
export const centredSlot = signal<number | null>(null);

/** Scrolls the row to a slot; null until the row attaches. */
export const goToSlot = signal<((slot: number) => void) | null>(null);

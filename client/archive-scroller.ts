/// <reference lib="dom" />

import type { SlotRange } from "#/game/date.ts";

/** Days kept loaded either side of the centre: three weeks, for fast flicks. */
const BUFFER = 21;
/** Days per fetch. */
const BATCH = 21;

type Options = {
  row: HTMLElement;
  /** Every slot the row spans. */
  bounds: SlotRange;
  /** The slots rendered by the server. */
  range: SlotRange;
  current: number;
  onMonth: (label: string) => void;
};

/**
 * Keeps the archive row loaded around what's in view: two sentinels stand in
 * for the unloaded days at full width, and shrink as cards replace them. A
 * landing far from the loaded cards replaces them instead. Returns a cleanup.
 */
export function attachArchiveScroller(
  { row, bounds, range: initial, current, onMonth }: Options,
) {
  const before = query(row, "[data-sentinel=before]");
  const after = query(row, "[data-sentinel=after]");

  let range = { ...initial };
  // Bumped on a jump, so batches for the old block are dropped
  let generation = 0;
  const pending = { before: false, after: false, jump: false };

  function metrics() {
    const style = getComputedStyle(row);
    const pitch = parseFloat(style.gridAutoColumns) +
      parseFloat(style.columnGap);
    return { pitch, origin: parseFloat(style.paddingLeft) };
  }

  /** The slot under the row's centre, fractional. */
  function centreSlot() {
    const { pitch, origin } = metrics();
    return bounds.from +
      (row.scrollLeft + row.clientWidth / 2 - origin) / pitch;
  }

  function setSpan(sentinel: HTMLElement, span: number) {
    sentinel.style.setProperty("--span", String(span));
    sentinel.dataset.span = String(span);
    sentinel.toggleAttribute("aria-hidden", span === 0);
  }

  async function fetchDays(from: number, to: number) {
    const response = await fetch(`/api/puzzles/days?from=${from}&to=${to}`);
    const template = document.createElement("template");
    template.innerHTML = await response.text();
    return [...template.content.children] as HTMLElement[];
  }

  async function loadBefore() {
    if (pending.before || range.from <= bounds.from) return;
    pending.before = true;
    const ticket = generation;
    try {
      const to = range.from - 1;
      const days = await fetchDays(Math.max(bounds.from, to - BATCH + 1), to);
      if (ticket !== generation) return;
      // One task: the cards take exactly the columns the span gives up
      before.after(...days);
      range.from -= days.length;
      setSpan(before, range.from - bounds.from);
    } catch {
      // Stays a skeleton; the next scroll retries
      return;
    } finally {
      if (ticket === generation) pending.before = false;
    }
    check();
  }

  async function loadAfter() {
    if (pending.after || range.to >= bounds.to) return;
    pending.after = true;
    const ticket = generation;
    try {
      const from = range.to + 1;
      const days = await fetchDays(from, Math.min(bounds.to, from + BATCH - 1));
      if (ticket !== generation) return;
      after.before(...days);
      range.to += days.length;
      setSpan(after, bounds.to - range.to);
    } catch {
      return;
    } finally {
      if (ticket === generation) pending.after = false;
    }
    check();
  }

  async function jump(centre: number) {
    if (pending.jump) return;
    const ticket = ++generation;
    pending.before = pending.after = false;
    pending.jump = true;
    try {
      const from = Math.max(bounds.from, centre - Math.floor(BATCH / 2));
      const to = Math.min(bounds.to, from + BATCH - 1);
      const days = await fetchDays(from, to);
      if (ticket !== generation) return;
      // The old block collapses into the spans; total width is unchanged
      while (before.nextElementSibling !== after) {
        before.nextElementSibling?.remove();
      }
      before.after(...days);
      range = { from, to: from + days.length - 1 };
      setSpan(before, range.from - bounds.from);
      setSpan(after, bounds.to - range.to);
    } catch {
      return;
    } finally {
      pending.jump = false;
    }
    check();
  }

  /** Loads what the view needs: the edges near it, or a block where it is. */
  function check() {
    if (pending.jump) return;
    const centre = Math.floor(centreSlot());
    if (centre < range.from - BUFFER || centre > range.to + BUFFER) {
      jump(centre);
      return;
    }
    if (centre - range.from < BUFFER) loadBefore();
    if (range.to - centre < BUFFER) loadAfter();
  }

  /** The centred day's card, if it's loaded. */
  function centreCard() {
    const slot = Math.floor(centreSlot());
    return row.querySelector<HTMLElement>(`[data-number="${slot}"]`);
  }

  function scrollToSlot(slot: number) {
    const { pitch, origin } = metrics();
    row.scrollTo({
      left: origin + (slot - bounds.from + 0.5) * pitch - row.clientWidth / 2,
      behavior: "instant",
    });
  }

  let frame = 0;
  function onScroll() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const card = centreCard();
      if (card?.dataset.month) onMonth(card.dataset.month);
    });
  }

  let settle: ReturnType<typeof setTimeout> | undefined;
  function onScrollSettled() {
    clearTimeout(settle);
    settle = setTimeout(() => {
      check();
      // So back and reload return here
      const card = centreCard();
      if (!card) return;
      const url = new URL(location.href);
      url.searchParams.set("date", card.id);
      url.hash = "";
      history.replaceState(history.state, "", url);
    }, 150);
  }

  const observer = new IntersectionObserver(check, {
    root: row,
    rootMargin: `0px ${BUFFER * metrics().pitch}px`,
  });
  observer.observe(before);
  observer.observe(after);

  row.addEventListener("scroll", onScroll, { passive: true });
  row.addEventListener("scroll", onScrollSettled, { passive: true });

  // A fragment already placed the day; otherwise centre it
  if (!location.hash) scrollToSlot(current);
  onScroll();
  check();

  return () => {
    observer.disconnect();
    row.removeEventListener("scroll", onScroll);
    row.removeEventListener("scroll", onScrollSettled);
    cancelAnimationFrame(frame);
    clearTimeout(settle);
  };
}

function query(root: HTMLElement, selector: string) {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

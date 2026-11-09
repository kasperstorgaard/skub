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
  /** The centred day's card, as the row scrolls. */
  onCentre: (card: HTMLElement) => void;
};

/**
 * Keeps the archive row loaded around what's in view: two sentinels stand in
 * for the unloaded days at full width, and shrink as cards replace them. A
 * jump to a far day replaces the loaded cards instead.
 */
export function attachArchiveScroller(
  { row, bounds, range: initial, current, onCentre }: Options,
) {
  const before = query(row, "[data-sentinel=before]");
  const after = query(row, "[data-sentinel=after]");

  let range = { ...initial };
  // Bumped on a jump, so batches for the old block are dropped
  let generation = 0;
  const pending = { before: false, after: false, jump: false };

  // Read once per size, not on every scroll frame
  let cached: { col: number; pitch: number; origin: number } | null = null;
  function metrics() {
    if (cached) return cached;
    const style = getComputedStyle(row);
    const col = parseFloat(style.gridAutoColumns);
    const pitch = col + parseFloat(style.columnGap);
    cached = { col, pitch, origin: parseFloat(style.paddingLeft) };
    return cached;
  }
  const onResize = () => cached = null;

  // Inserting cards mid-fling cuts momentum short on touch, so batches wait
  let isScrolling = false;
  let waiting: (() => void)[] = [];
  function whenSettled() {
    if (!isScrolling) return Promise.resolve();
    return new Promise<void>((resolve) => waiting.push(resolve));
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
      await whenSettled();
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
      await whenSettled();
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

  /** Scrolls to a day, first replacing the block if it isn't loaded. */
  async function goTo(slot: number) {
    if (slot >= range.from && slot <= range.to) return scrollToSlot(slot);
    if (pending.jump) return;
    const ticket = ++generation;
    pending.before = pending.after = false;
    pending.jump = true;
    try {
      const from = Math.max(bounds.from, slot - Math.floor(BATCH / 2));
      const to = Math.min(bounds.to, from + BATCH - 1);
      const days = await fetchDays(from, to);
      await whenSettled();
      if (ticket !== generation) return;
      // The old block collapses into the spans; total width is unchanged
      while (before.nextElementSibling !== after) {
        before.nextElementSibling?.remove();
      }
      before.after(...days);
      range = { from, to: from + days.length - 1 };
      setSpan(before, range.from - bounds.from);
      setSpan(after, bounds.to - range.to);
      // Same task as the swap, so the old spot never paints as skeletons
      scrollToSlot(slot);
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
      goTo(centre);
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
    const { col, pitch, origin } = metrics();
    row.scrollTo({
      left: origin + (slot - bounds.from) * pitch + col / 2 -
        row.clientWidth / 2,
      behavior: "instant",
    });
  }

  let centred: HTMLElement | null = null;
  function markCentred(card: HTMLElement | null) {
    if (card === centred) return;
    centred?.removeAttribute("data-centred");
    card?.setAttribute("data-centred", "");
    centred = card;
  }

  let frame = 0;
  function onScroll() {
    isScrolling = true;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const card = centreCard();
      markCentred(card);
      if (card) onCentre(card);
    });
  }

  let settle: ReturnType<typeof setTimeout> | undefined;
  function onScrollSettled() {
    clearTimeout(settle);
    settle = setTimeout(() => {
      isScrolling = false;
      const resolves = waiting;
      waiting = [];
      resolves.forEach((resolve) => resolve());
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

  addEventListener("resize", onResize);
  row.addEventListener("scroll", onScroll, { passive: true });
  row.addEventListener("scroll", onScrollSettled, { passive: true });

  // A fragment already placed the day; otherwise centre it
  if (!location.hash) scrollToSlot(current);
  onScroll();
  check();

  function detach() {
    observer.disconnect();
    removeEventListener("resize", onResize);
    row.removeEventListener("scroll", onScroll);
    row.removeEventListener("scroll", onScrollSettled);
    cancelAnimationFrame(frame);
    clearTimeout(settle);
  }

  return { detach, goTo };
}

function query(root: HTMLElement, selector: string) {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

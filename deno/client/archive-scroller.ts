/// <reference lib="dom" />

import { h, render } from "preact";

import { Thumbnail } from "#/components/thumbnail.tsx";
import { decodeBoard } from "#/game/board.ts";
import type { SlotRange } from "#/game/date.ts";

/** Cards drawn ahead of the view on each side: a fast flick's worth. */
const AHEAD = 10;

type Options = {
  row: HTMLElement;
  /** Every slot the row spans. */
  bounds: SlotRange;
  current: number;
  /** The centred day's card, as the row scrolls. */
  onCentre: (card: HTMLElement) => void;
};

/**
 * Every day is already in the row, so its scroll width is fixed and the same
 * flick always throws the same distance. This only draws the thumbnails
 * nearing view, into boxes of fixed size, and tracks the centred day.
 */
export function attachArchiveScroller(
  { row, bounds, current, onCentre }: Options,
) {
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

  /** The slot under the row's centre, fractional. */
  function centreSlot() {
    const { pitch, origin } = metrics();
    return bounds.from +
      (row.scrollLeft + row.clientWidth / 2 - origin) / pitch;
  }

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

  // Drawn once and kept: the box is already its final size, so filling it
  // never moves anything, even mid-fling
  const drawer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting || !(target instanceof HTMLElement)) continue;
      drawer.unobserve(target);
      const encoding = target.dataset.board?.split(",").map(Number) ?? [];
      target.removeAttribute("data-board");
      render(
        h(Thumbnail, { board: decodeBoard(encoding), className: "size-full" }),
        target,
      );
    }
  }, {
    root: row,
    rootMargin: `0px ${AHEAD * metrics().pitch}px`,
  });
  row.querySelectorAll("[data-board]").forEach((box) => drawer.observe(box));

  let centred: HTMLElement | null = null;
  function markCentred(card: HTMLElement | null) {
    if (card === centred) return;
    centred?.removeAttribute("data-centred");
    card?.setAttribute("data-centred", "");
    centred = card;
  }

  let frame = 0;
  function onScroll() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const card = centreCard();
      markCentred(card);
      if (card) onCentre(card);
    });
  }

  // So back and reload return here
  function onSettled() {
    clearTimeout(settle);
    const card = centreCard();
    if (!card) return;
    const url = new URL(location.href);
    url.searchParams.set("date", card.id);
    url.hash = "";
    history.replaceState(history.state, "", url);
  }

  // `scrollend` fires once momentum and snapping are done; a timer otherwise
  const hasScrollEnd = "onscrollend" in row;
  let settle: ReturnType<typeof setTimeout> | undefined;
  function onScrollSettled() {
    if (hasScrollEnd) return;
    clearTimeout(settle);
    settle = setTimeout(onSettled, 150);
  }

  addEventListener("resize", onResize);
  row.addEventListener("scroll", onScroll, { passive: true });
  row.addEventListener("scroll", onScrollSettled, { passive: true });
  row.addEventListener("scrollend", onSettled);

  // A fragment already placed the day; otherwise centre it
  if (!location.hash) scrollToSlot(current);
  onScroll();

  function detach() {
    drawer.disconnect();
    removeEventListener("resize", onResize);
    row.removeEventListener("scroll", onScroll);
    row.removeEventListener("scroll", onScrollSettled);
    row.removeEventListener("scrollend", onSettled);
    cancelAnimationFrame(frame);
    clearTimeout(settle);
  }

  return { detach, goTo: scrollToSlot };
}

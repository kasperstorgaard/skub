import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useEffect, useMemo } from "preact/hooks";

import { hintUsed } from "#/client/hint-signals.ts";
import { useGameShortcuts } from "#/client/keyboard.ts";
import {
  ArrowArcLeft,
  ArrowArcRight,
  Download,
  Icon,
  Pencil,
  Printer,
  Ranking,
  Star,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { Puzzle } from "#/game/types.ts";
import {
  decodeState,
  getHintHref,
  getRedoHref,
  getResetHref,
  getUndoHref,
} from "#/game/url.ts";
import { useRouter } from "#/islands/router.tsx";

type ControlsPanelProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  isDev: boolean;
  showEdit?: boolean;
  hintCount?: number;
  isPreview?: boolean;
  className?: string;
};

export function ControlsPanel(
  {
    puzzle,
    href,
    isDev,
    showEdit,
    hintCount,
    isPreview,
    className,
  }: ControlsPanelProps,
) {
  const hintLimit = 1;
  // Mirrors the hint route's gate. hintCount is server-rendered and the
  // enhanced path never reloads, so a hint taken here shows up in the signal.
  const hintDisabled = !isDev && !isPreview &&
    (hintCount ?? 0) + (hintUsed.value ? 1 : 0) >= hintLimit;

  const state = useMemo(() => decodeState(href.value), [href.value]);

  const count = useMemo(() => Math.min(state.moves.length, state.cursor ?? 0), [
    state.moves.length,
    state.cursor,
  ]);

  const { updateLocation } = useRouter();

  const onReset = useCallback(() => updateLocation(getResetHref(href.value)), [
    href.value,
  ]);

  // Opens the dialog straight away and lets it fetch the hint, rather than
  // waiting on the route's redirect. The anchor keeps its href so the no-JS
  // path still navigates and comes back with the hint in the URL.
  const onHint = useCallback(() => {
    if (hintDisabled) return;
    const url = new URL(href.value);
    url.searchParams.set("dialog", "hint");
    updateLocation(url.href);
  }, [href.value, hintDisabled]);

  useGameShortcuts({
    onUndo: () => self.history.back(),
    onRedo: () => self.history.forward(),
    onReset,
    onHint,
  });

  // Clear game state before print
  // TODO: find a less magic place for this global board concern
  useEffect(() => {
    if (!("onbeforeprint" in globalThis)) return;

    globalThis.addEventListener("beforeprint", onReset);
    return () => globalThis.removeEventListener("beforeprint", onReset);
  }, []);

  // Print on load if search params has ?print
  // TODO: find a less magic place for this global board concern
  useEffect(() => {
    const url = new URL(href.value);

    if (!url.searchParams.has("print")) return;
    if (!("print" in globalThis)) return;

    globalThis.print();

    url.searchParams.delete("print");
    updateLocation(url.href);
  }, [href.value]);

  return (
    <Panel className={className}>
      <div
        className={clsx(
          "grid max-lg:col-[2/3] grid-cols-subgrid place-content-center items-center w-full max-lg:gap-8",
          "lg:grid lg:row-[3/4] lg:items-start lg:grid-rows-[1fr_auto] gap-fl-3",
        )}
      >
        <div className="flex flex-col gap-fl-2 justify-start">
          <div
            className={clsx(
              "flex place-items-center justify-center gap-3 w-full",
              "lg:place-self-center",
            )}
          >
            <a
              href={getUndoHref(href.value, state)}
              className="icon-btn"
              aria-disabled={!state.cursor ? true : undefined}
              data-primary
              data-size="lg"
              data-router="replace"
            >
              <Icon icon={ArrowArcLeft} />
            </a>

            <div
              className={clsx(
                "flex items-center justify-center min-w-[2ch] font-3",
                "text-center leading-flat font-3 tracking-wide text-8 tabular-nums",
              )}
            >
              {count < 10 ? `0${count}` : count}
            </div>

            <a
              href={getRedoHref(href.value, state)}
              className="icon-btn"
              aria-disabled={state.cursor == null ||
                  state.cursor === state.moves.length
                ? true
                : undefined}
              data-primary
              data-size="lg"
              data-router="replace"
            >
              <Icon icon={ArrowArcRight} />
            </a>
          </div>

          <div
            className={clsx(
              "flex gap-2 justify-center flex-wrap",
              "lg:justify-self-center",
            )}
          >
            {
              /*
            The /hint route solves server-side and redirects back with the hint
            in the query params. Solving is expensive, so it stays on demand.
          */
            }
            {puzzle.value.slug !== "preview" && (
              <a
                href={hintDisabled ? "#" : getHintHref(href.value)}
                aria-disabled={hintDisabled ? true : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onHint();
                }}
              >
                {hintDisabled ? "Hint used" : "Get a hint"}
              </a>
            )}

            <a
              href={getResetHref(href.value)}
              className="bg-transparent"
              data-router="replace"
            >
              Start over
            </a>
          </div>
        </div>

        <div className="flex justify-center gap-fl-1 flex-wrap lg:grid lg:grid-cols-1">
          <button
            type="button"
            className="btn"
            onClick={() => globalThis.print()}
          >
            <Icon icon={Printer} /> Print
          </button>

          {!isPreview && (
            <a
              href={`/puzzles/${puzzle.value.slug}/solutions`}
              className="btn"
            >
              <Icon icon={Ranking} /> See solves
            </a>
          )}

          {isPreview && (
            <a href="/api/export" download className="btn">
              <Icon icon={Download} />
              Download
            </a>
          )}

          {showEdit && (
            <a
              href={`/puzzles/${puzzle.value.slug}/clone`}
              className="btn"
            >
              <Icon icon={Pencil} /> Edit
            </a>
          )}

          {
            /* Straight to the candidate page, not via clone: clone mangles
              identity for remixing, and a rating filed under "Untitled, 0
              moves" is useless as an anchor. */
          }
          {isDev && !isPreview && (
            <a href={`/candidate?slug=${puzzle.value.slug}`} className="btn">
              <Icon icon={Star} /> Rate
            </a>
          )}
        </div>
      </div>
    </Panel>
  );
}

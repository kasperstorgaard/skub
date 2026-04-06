import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useEffect, useMemo } from "preact/hooks";

import { useGameShortcuts } from "#/client/keyboard.ts";
import {
  ArrowArcLeft,
  ArrowArcRight,
  Download,
  Icon,
  Printer,
  Ranking,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { Puzzle, SkillLevel } from "#/game/types.ts";
import {
  decodeState,
  getHintHref,
  getRedoHref,
  getResetHref,
  getSolveHref,
  getUndoHref,
} from "#/game/url.ts";
import { useRouter } from "#/islands/router.tsx";

type ControlsPanelProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  isDev: boolean;
  hintCount?: number;
  isPreview?: boolean;
  skillLevel?: SkillLevel | null;
  className?: string;
};

export function ControlsPanel(
  { puzzle, href, isDev, hintCount, isPreview, skillLevel = "intermediate", className }:
    ControlsPanelProps,
) {
  const hintLimit = 1;
  const hintDisabled = !isDev && !isPreview &&
    skillLevel !== null && skillLevel !== "beginner" &&
    (hintCount ?? 0) >= hintLimit;

  const state = useMemo(() => decodeState(href.value), [href.value]);

  const count = useMemo(() => Math.min(state.moves.length, state.cursor ?? 0), [
    state.moves.length,
    state.cursor,
  ]);

  const { updateLocation } = useRouter();

  const onReset = useCallback(() => updateLocation(getResetHref(href.value)), [
    href.value,
  ]);

  useGameShortcuts({
    onUndo: () => self.history.back(),
    onRedo: () => self.history.forward(),
    onReset,
    onHint: () => {
      if (hintDisabled) return;
      globalThis.location.href = getHintHref(href.value);
    },
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
            Navigates to the /hint route,
            which provides a hint as a redirect back in the query params.
            This is slightly expensive, so needs to be on demand, not optimistic.
          */
            }
            {puzzle.value.slug !== "preview"
              ? (
                <a
                  href={hintDisabled ? "#" : getHintHref(href.value)}
                  aria-disabled={hintDisabled ? true : undefined}
                  onClick={(event) => {
                    if (hintDisabled) event.preventDefault();
                  }}
                  className="noscript:hidden"
                >
                  {!hintDisabled
                    ? "Get a hint"
                    : puzzle.value.difficulty === "easy"
                    ? "Hints used"
                    : "Hint used"}
                </a>
              )
              : (
                <a
                  href={getSolveHref(href.value)}
                  className="noscript:hidden"
                >
                  Solve
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

          {!isPreview &&
            puzzle.value.slug !== "preview" &&
            (
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
        </div>
      </div>
    </Panel>
  );
}

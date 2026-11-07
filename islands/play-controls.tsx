import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useEffect, useMemo } from "preact/hooks";

import { hintUsed } from "#/client/hint-signals.ts";
import { useGameShortcuts } from "#/client/keyboard.ts";
import {
  ArrowArcLeft,
  ArrowArcRight,
  ArrowCounterClockwise,
  Icon,
  Lightbulb,
} from "#/components/icons.tsx";
import { KeyHint } from "#/components/key-hint.tsx";
import { TOOL_BUTTON, Toolbar } from "#/components/toolbar.tsx";
import { isLooped } from "#/game/board.ts";
import type { Puzzle } from "#/game/types.ts";
import {
  decodeState,
  getHintHref,
  getRedoHref,
  getResetHref,
  getUndoHref,
} from "#/game/url.ts";
import { FlashSwitch } from "#/islands/flash-switch.tsx";
import { useRouter } from "#/islands/router.tsx";

type PlayControlsProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  isDev: boolean;
  hintCount?: number;
  /** The Flash switch, for puzzles that have a Flash start. */
  flash?: {
    isOn: boolean;
    /** The Flash dialog was answered before, so the switch skips it. */
    isExplained: boolean;
  };
  isPreview?: boolean;
  className?: string;
};

// Tool buttons that can be off fade out
const TOOL = clsx(
  TOOL_BUTTON,
  "aria-disabled:opacity-40",
);

// Not a control. Desktop only; touch swipes.
function ArrowKeysHint() {
  return (
    <p
      className={clsx(
        "not-lg:hidden col-span-2 row-span-2 self-start mt-1 w-[150%]",
        "font-mono text-0 leading-tight text-text-1",
      )}
    >
      optional:<br />use arrow keys and TAB to move
    </p>
  );
}

/** Beside the board: undo, redo, hint, start over, Flash, and how to move. */
export function PlayControls(
  { puzzle, href, isDev, hintCount, flash, isPreview, className }:
    PlayControlsProps,
) {
  // A board caught in a portal loop has one way on, and the hint route refuses
  // it too — offering one here would only 400.
  const isLocked = useMemo(() => {
    const state = decodeState(href.value);
    const played = state.moves.slice(0, state.cursor ?? state.moves.length);

    return isLooped(puzzle.value.board, played);
  }, [href.value, puzzle.value.board]);

  const hintLimit = 1;
  // Mirrors the hint route's gate. hintCount is server-rendered and the
  // enhanced path never reloads, so a hint taken here shows up in the signal.
  const hintSpent = !isDev && !isPreview &&
    (hintCount ?? 0) + (hintUsed.value ? 1 : 0) >= hintLimit;

  const hintDisabled = isLocked || hintSpent;

  const state = useMemo(() => decodeState(href.value), [href.value]);

  const { updateLocation } = useRouter();

  const onReset = useCallback(() => updateLocation(getResetHref(href.value)), [
    href.value,
  ]);

  // Opens the dialog straight away and lets it fetch the hint, rather than
  // waiting on the route's redirect. Without JS the form posts to the route
  // and comes back with the hint in the URL.
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
    <Toolbar
      size="lg"
      className={clsx(
        "print:hidden",
        // Four tools, the gap, then Flash; on desktop Flash and the gap go
        // first. Flash only comes with the hint.
        flash &&
          "max-lg:grid-cols-[repeat(4,minmax(0,3.5rem))_0_minmax(0,3.5rem)]",
        flash && "lg:grid-rows-[2.5rem_0.5rem_repeat(4,2.5rem)]",
        className,
      )}
    >
      <a
        href={getUndoHref(href.value, state)}
        className={TOOL}
        aria-disabled={!state.cursor ? true : undefined}
        aria-label="Undo"
        data-router="replace"
      >
        <Icon
          icon={ArrowArcLeft}
          className="text-[1.25rem] max-lg:text-[2rem]"
        />
      </a>
      <KeyHint>U</KeyHint>

      <a
        href={getRedoHref(href.value, state)}
        className={TOOL}
        aria-disabled={state.cursor == null ||
            state.cursor === state.moves.length
          ? true
          : undefined}
        aria-label="Redo"
        data-router="replace"
      >
        <Icon
          icon={ArrowArcRight}
          className="text-[1.25rem] max-lg:text-[2rem]"
        />
      </a>
      <KeyHint>R</KeyHint>

      {
        /*
          The /hint route solves server-side and redirects back with the hint
          in the query params. A form, not a link, so crawlers can't trigger
          the solve.
        */
      }
      {puzzle.value.slug !== "preview" && (
        <>
          <form
            method="post"
            action={getHintHref(href.value)}
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              onHint();
            }}
          >
            <button
              type="submit"
              // Spent: faded like any off tool, and struck through
              className={TOOL}
              disabled={hintDisabled}
              aria-disabled={hintDisabled ? true : undefined}
              aria-label={hintSpent ? "Hint used" : "Get a hint"}
              title={hintSpent ? "Hint used" : "Get a hint"}
            >
              <span className="relative grid place-items-center">
                <Icon
                  icon={Lightbulb}
                  className="text-[1.25rem] max-lg:text-[2rem]"
                />
                {hintSpent && (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "absolute inset-0 pointer-events-none",
                      // A 2px line from bottom-left to top-right
                      "[background:linear-gradient(to_bottom_right,transparent_calc(50%-1px),currentColor_calc(50%-1px)_calc(50%+1px),transparent_calc(50%+1px))]",
                    )}
                  />
                )}
              </span>
            </button>
          </form>
          <KeyHint>H</KeyHint>
        </>
      )}

      <a
        href={getResetHref(href.value)}
        className={TOOL}
        aria-label="Start over"
        title="Start over"
        data-router="replace"
      >
        <Icon
          icon={ArrowCounterClockwise}
          className="text-[1.25rem] max-lg:text-[2rem]"
        />
      </a>
      <KeyHint>⇧U</KeyHint>

      {flash && (
        <>
          {/* The gap before Flash: its own track, so the toolbar stays centred */}
          <span aria-hidden="true" className="lg:col-span-2 lg:-order-1" />
          <FlashSwitch
            href={href}
            isOn={flash.isOn}
            isExplained={flash.isExplained}
            className={clsx(TOOL, "text-text-2 lg:-order-2")}
            iconClassName="text-[1.25rem] max-lg:text-[2rem]"
          />
        </>
      )}

      <ArrowKeysHint />
    </Toolbar>
  );
}

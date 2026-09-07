import type { Signal } from "@preact/signals";
import clsx from "clsx/lite";
import { useMemo } from "preact/hooks";

import { useEditor } from "#/client/editor.ts";
import { Icon, X } from "#/components/icons.tsx";
import { KeyHint } from "#/components/key-hint.tsx";
import { PortalRings } from "#/components/portal-rings.tsx";
import type { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";

type EditorToolbarProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  /** A tile has neither, so its builder leaves both tools out. */
  hidePuck?: boolean;
  hideDestination?: boolean;
  className?: string;
};

/**
 * Toolbar for the puzzle editor.
 * On mobile: flows inline inside Main.
 * On desktop: breaks out to the right of Main via absolute positioning.
 */
export function EditorToolbar(
  { href, puzzle, hidePuck, hideDestination, className }: EditorToolbarProps,
) {
  const active = useMemo(
    () => decodeState(href.value).active,
    [href.value],
  );

  const { toggleWall, setCellContent, setDestination } = useEditor({
    puzzle,
    active,
  });

  const disabled = active == null;

  return (
    <div
      className={clsx(
        "grid grid-cols-[repeat(4,2.5rem)] h-fit place-content-center gap-1",
        "lg:grid-cols-[auto_1.5rem] lg:auto-rows-[2.5rem]",
        className,
      )}
    >
      <button
        type="button"
        className="p-1.5 bg-transparent border-2 border-link rounded-2"
        aria-label="Horizontal wall"
        disabled={disabled}
        onClick={() => toggleWall("horizontal")}
      >
        <div className="size-5 border-t-[3px] border-ui-4" />
      </button>

      <button
        type="button"
        className="flex items-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Vertical wall"
        disabled={disabled}
        onClick={() => toggleWall("vertical")}
      >
        <div className="size-5 border-l-[3px] border-ui-4" />
      </button>

      <button
        type="button"
        className="flex items-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Both walls"
        disabled={disabled}
        onClick={() => toggleWall("both")}
      >
        <div className="size-5 border-t-[3px] border-l-[3px] border-ui-4" />
      </button>

      <KeyHint rows={3} className="row-[1/4]">W</KeyHint>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Blocker"
        disabled={disabled}
        onClick={() => setCellContent("blocker")}
      >
        <div className="size-4 bg-ui-3 rounded-1" />
      </button>

      {!hidePuck && (
        <button
          type="button"
          className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
          aria-label="Puck"
          disabled={disabled}
          onClick={() => setCellContent("puck")}
        >
          <div className="size-4 bg-ui-2 rounded-round" />
        </button>
      )}

      <button
        type="button"
        className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Hole"
        disabled={disabled}
        onClick={() => setCellContent("hole")}
      >
        <div className="size-5 bg-hole rounded-1" />
      </button>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Portal"
        disabled={disabled}
        onClick={() => setCellContent("portal")}
      >
        <div className="size-5 rounded-1 overflow-hidden bg-portal-alt relative">
          <PortalRings compact />
        </div>
      </button>

      {
        /* The bracket spans the cell buttons it belongs to, and a tile has no
          puck among them. */
      }
      <KeyHint rows={hidePuck ? 3 : 4} className="row-start-4">P</KeyHint>

      {!hideDestination && (
        <>
          <button
            type="button"
            className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
            aria-label="Destination"
            disabled={disabled}
            onClick={setDestination}
          >
            <div className="size-5 border-2 border-ui-1 flex items-center justify-center">
              <Icon icon={X} className="text-ui-1 text-fl-0" />
            </div>
          </button>

          <KeyHint>D</KeyHint>
        </>
      )}
    </div>
  );
}

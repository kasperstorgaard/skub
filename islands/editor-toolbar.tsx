import type { Signal } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { useEditor } from "#/client/editor.ts";
import { Icon, X } from "#/components/icons.tsx";
import { KeyHint } from "#/components/key-hint.tsx";
import { PortalRings } from "#/components/portal-rings.tsx";
import { TOOL_BUTTON, Toolbar } from "#/components/toolbar.tsx";
import type { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";

type EditorToolbarProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  className?: string;
};

/**
 * Toolbar for the puzzle editor.
 * On mobile: flows inline inside Main.
 * On desktop: breaks out to the right of Main via absolute positioning.
 */
export function EditorToolbar(
  { href, puzzle, className }: EditorToolbarProps,
) {
  const active = useMemo(
    () => decodeState(href.value).active,
    [href.value],
  );

  const { toggleWall, toggleCorner, setCellContent, setDestination } =
    useEditor({
      puzzle,
      active,
    });

  const disabled = active == null;

  return (
    <Toolbar className={className}>
      <button
        type="button"
        className={TOOL_BUTTON}
        aria-label="Horizontal wall"
        disabled={disabled}
        onClick={() => toggleWall("horizontal")}
      >
        <div className="size-5 border-t-[3px] border-ui-4" />
      </button>

      <button
        type="button"
        className={TOOL_BUTTON}
        aria-label="Vertical wall"
        disabled={disabled}
        onClick={() => toggleWall("vertical")}
      >
        <div className="size-5 border-l-[3px] border-ui-4" />
      </button>

      <KeyHint className="row-[1/3]">W</KeyHint>

      <button
        type="button"
        className={TOOL_BUTTON}
        aria-label="Corner wall"
        disabled={disabled}
        onClick={toggleCorner}
      >
        <div className="size-5 border-t-[3px] border-l-[3px] border-ui-4" />
      </button>

      <KeyHint>C</KeyHint>

      <button
        type="button"
        className={TOOL_BUTTON}
        aria-label="Blocker"
        disabled={disabled}
        onClick={() => setCellContent("blocker")}
      >
        <div className="size-4 bg-ui-3 rounded-1" />
      </button>

      <button
        type="button"
        className={TOOL_BUTTON}
        aria-label="Puck"
        disabled={disabled}
        onClick={() => setCellContent("puck")}
      >
        <div className="size-4 bg-ui-2 rounded-round" />
      </button>

      <button
        type="button"
        className={TOOL_BUTTON}
        aria-label="Hole"
        disabled={disabled}
        onClick={() => setCellContent("hole")}
      >
        <div className="size-5 bg-hole rounded-1" />
      </button>

      <button
        type="button"
        className={TOOL_BUTTON}
        aria-label="Portal"
        disabled={disabled}
        onClick={() => setCellContent("portal")}
      >
        <div className="size-5 rounded-1 overflow-hidden bg-portal-alt relative">
          <PortalRings compact />
        </div>
      </button>

      {/* The bracket spans the cell buttons it belongs to. */}
      <KeyHint className="row-[4/8]">P</KeyHint>

      <button
        type="button"
        className={TOOL_BUTTON}
        aria-label="Destination"
        disabled={disabled}
        onClick={setDestination}
      >
        <div className="size-5 border-2 border-ui-1 flex items-center justify-center">
          <Icon icon={X} className="text-ui-1 text-fl-0" />
        </div>
      </button>

      <KeyHint>D</KeyHint>
    </Toolbar>
  );
}

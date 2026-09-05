import type { Signal } from "@preact/signals";
import clsx from "clsx/lite";
import { useMemo } from "preact/hooks";

import { useEditor } from "#/client/editor.ts";
import { Icon, X } from "#/components/icons.tsx";
import { PortalRings } from "#/components/portal-rings.tsx";
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
export function EditorToolbar({ href, puzzle, className }: EditorToolbarProps) {
  const active = useMemo(
    () => decodeState(href.value).active,
    [href.value],
  );

  const { toggleWall, setCellContent, setDestination, allowed } = useEditor({
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

      <div
        className={clsx(
          "not-lg:hidden col-2 row-[1/4] relative flex items-center justify-center p-1",
        )}
      >
        <BracketBackground className="absolute inset-0" />
        <kbd className="relative z-0">W</kbd>
      </div>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Blocker"
        disabled={disabled}
        onClick={() => setCellContent("blocker")}
      >
        <div className="size-4 bg-ui-3 rounded-1" />
      </button>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Puck"
        disabled={disabled}
        onClick={() => setCellContent("puck")}
      >
        <div className="size-4 bg-ui-2 rounded-round" />
      </button>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Hole"
        disabled={disabled || !allowed.includes("hole")}
        onClick={() => setCellContent("hole")}
      >
        <div className="size-5 bg-hole rounded-1" />
      </button>

      <button
        type="button"
        className="flex items-center justify-center bg-transparent  border-2 border-link rounded-2"
        aria-label="Portal"
        disabled={disabled || !allowed.includes("portal")}
        onClick={() => setCellContent("portal")}
      >
        <div className="size-5 rounded-1 overflow-hidden bg-portal-alt relative">
          <PortalRings compact />
        </div>
      </button>

      <div
        className={clsx(
          "not-lg:hidden col-2 row-start-4 row-span-4 relative flex items-center justify-center p-1",
        )}
      >
        <BracketBackground className="absolute inset-0" />
        <kbd className="relative z-0">P</kbd>
      </div>

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

      <div
        className={clsx(
          "not-lg:hidden col-2 relative flex items-center justify-center p-1",
        )}
      >
        <BracketBackground className="absolute inset-0" />
        <kbd className="relative z-0">D</kbd>
      </div>
    </div>
  );
}

type BracketProps = {
  className?: string;
};

// Open-left bracket connecting button rows to their kbd shortcut on desktop.
function BracketBackground({ className }: BracketProps) {
  return (
    <svg
      className={clsx(
        "size-full pointer-events-none py-1",
        className,
      )}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M 0 2 H 50 V 98 H 0"
        stroke="var(--color-text-3)"
        fill="none"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  );
}

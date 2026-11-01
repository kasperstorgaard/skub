import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { Eye, EyeSlash, Icon } from "#/components/icons.tsx";

type EditorSolutionToggleProps = {
  showSolution: Signal<boolean>;
  /** Changes colour with the switch. */
  children: preact.ComponentChildren;
  className?: string;
};

/**
 * Shows the solution on the board. The icon says what clicking will do, and
 * `children` stay where they are, changing colour while it's on.
 */
export function EditorSolutionToggle(
  { showSolution, children, className }: EditorSolutionToggleProps,
) {
  const isOn = showSolution.value;

  return (
    <label
      title={isOn ? "Hide the solution" : "Show the solution on the board"}
      className={clsx(
        "group grid grid-cols-2 place-items-stretch shrink-0",
        "h-[2.25rem] w-[4.5rem] cursor-pointer",
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label="Overlay"
        className="peer sr-only"
        checked={isOn}
        onChange={(event) => showSolution.value = event.currentTarget.checked}
      />

      <span
        aria-hidden="true"
        className={clsx(
          "grid place-items-center bg-surface-1 text-text-2 shadow-inner",
          "group-hover:text-text-1",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-3px]",
          "peer-focus-visible:outline-text-1",
        )}
      >
        <Icon icon={isOn ? EyeSlash : Eye} />
      </span>

      <span
        className={clsx(
          "transition-colors duration-200 ease-out",
          "motion-reduce:transition-none",
          "group-hover:brightness-125",
          isOn ? "bg-text-2 text-surface-1" : "bg-surface-3",
        )}
      >
        {children}
      </span>
    </label>
  );
}

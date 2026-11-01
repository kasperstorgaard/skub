import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { KeyHint } from "#/components/key-hint.tsx";

type EditorSolutionToggleProps = {
  showSolution: Signal<boolean>;
  className?: string;
};

/** Shows the solution on the board. Holding Shift does the same for a moment. */
export function EditorSolutionToggle(
  { showSolution, className }: EditorSolutionToggleProps,
) {
  return (
    <label
      className={clsx(
        "gui-switch grid justify-items-start gap-1",
        "text-0 text-text-2",
        className,
      )}
    >
      <span>Overlay</span>
      <input
        type="checkbox"
        role="switch"
        className="col-1 row-2"
        checked={showSolution.value}
        onChange={(event) => showSolution.value = event.currentTarget.checked}
      />
      <KeyHint className="row-[1/3] self-stretch">Shift</KeyHint>
    </label>
  );
}

import clsx from "clsx/lite";

type ToolbarProps = {
  children: preact.ComponentChildren;
  /** lg: bigger buttons in the mobile row, for thumbs while playing */
  size?: "md" | "lg";
  className?: string;
};

/**
 * A board's toolbar: a row under the board on mobile, a column beside it on
 * desktop with each tool's `KeyHint` in the second column. Placement beside
 * the board comes in through className.
 */
export function Toolbar({ children, size = "md", className }: ToolbarProps) {
  return (
    <div
      className={clsx(
        "grid h-fit place-content-center lg:gap-1",
        // Columns flow, so the row fits however many tools got drawn.
        "max-lg:w-full max-lg:grid-flow-col",
        size === "lg"
          ? "max-lg:auto-cols-[minmax(0,3.5rem)] max-lg:gap-3"
          : "max-lg:auto-cols-[minmax(0,2.5rem)] max-lg:gap-1",
        "lg:grid-cols-[auto_1.5rem] lg:auto-rows-[2.5rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A toolbar button; holds a `size-5` glyph. */
export const TOOL_BUTTON =
  "flex items-center justify-center p-1.5 bg-transparent border-2 border-link rounded-2";

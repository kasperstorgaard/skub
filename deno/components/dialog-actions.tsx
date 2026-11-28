import { clsx } from "clsx/lite";

type DialogActionsProps = {
  /** One or two calls to action, never more: full width, side by side. */
  children?: preact.ComponentChildren;
  /** The single way out (cancel, not now, back), as a quiet link below. */
  dismiss?: preact.ComponentChildren;
  className?: string;
};

/** The foot of every dialog: calls to action on top, the way out below. */
export function DialogActions(
  { children, dismiss, className }: DialogActionsProps,
) {
  return (
    <div className={clsx("grid gap-fl-1 w-full", className)}>
      {children && (
        <div className="grid grid-flow-col auto-cols-fr gap-fl-1">
          {children}
        </div>
      )}
      {dismiss && <div className="flex justify-center mt-1">{dismiss}</div>}
    </div>
  );
}

/** A dismiss link or button in `DialogActions`. */
export const DISMISS =
  "link p-0 bg-transparent text-1 text-text-2 cursor-pointer";

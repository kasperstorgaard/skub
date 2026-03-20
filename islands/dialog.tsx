import { clsx } from "clsx/lite";
import type { DialogHTMLAttributes } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

type Props = DialogHTMLAttributes<HTMLDialogElement>;

// TODO: dialog styles need work — background, border, spacing and overall
// feel aren't quite right yet. Revisit as part of the global component polish.
export function Dialog({ open, className, children, ...rest }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    ref.current?.close();
    if (open) ref.current?.showModal();
  }, [open]);

  // Remove from DOM if not open
  if (!open) return null;

  return (
    <dialog
      ref={ref}
      data-modal
      open
      className={clsx(
        "m-auto rounded-cond-2 max-sm:max-w-[90vw] max-w-lg shadow-4 z-5 min-w-92 lg:min-w-100",
        className,
      )}
      {...rest}
    >
      <div className="flex flex-col gap-fl-3 p-fl-2">
        {children}
      </div>
    </dialog>
  );
}

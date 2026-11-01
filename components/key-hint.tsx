import { clsx } from "clsx/lite";

type KeyHintProps = {
  /** The key that does what the buttons beside it do. */
  children: preact.ComponentChildren;
  /** Sits above its control, bracketed down to it, rather than beside it. */
  above?: boolean;
  className?: string;
};

/**
 * The keyboard shortcut beside a toolbar's buttons, bracketed to the rows it
 * belongs to. Desktop only: there is no key to press on a touch screen.
 *
 * Which rows it spans is the toolbar's to say — it knows which buttons it drew
 * and how many — so placement comes in through className.
 */
export function KeyHint({ children, above, className }: KeyHintProps) {
  return (
    <div
      className={clsx(
        "not-lg:hidden relative flex items-center justify-center p-1",
        !above && "col-2",
        className,
      )}
    >
      <BracketBackground above={above} className="absolute inset-0" />
      <kbd className="relative z-0">{children}</kbd>
    </div>
  );
}

type BracketProps = {
  above?: boolean;
  className?: string;
};

// Open bracket connecting buttons to their kbd shortcut on desktop: open to the
// left beside them, open to the bottom above them.
function BracketBackground({ above, className }: BracketProps) {
  return (
    <svg
      className={clsx(
        "size-full pointer-events-none",
        above ? "px-1" : "py-1",
        className,
      )}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={above ? "M 2 100 V 50 H 98 V 100" : "M 0 2 H 50 V 98 H 0"}
        stroke="var(--color-text-3)"
        fill="none"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  );
}

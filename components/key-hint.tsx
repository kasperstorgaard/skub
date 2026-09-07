import { clsx } from "clsx/lite";

type KeyHintProps = {
  /** The key that does what the buttons beside it do. */
  children: preact.ComponentChildren;
  /** How many button rows the hint belongs to, on large screens. */
  rows?: 1 | 3 | 4;
  className?: string;
};

const SPANS = {
  1: "",
  3: "row-span-3",
  4: "row-span-4",
};

/**
 * The keyboard shortcut beside a toolbar's buttons, bracketed to the rows it
 * belongs to. Desktop only: there is no key to press on a touch screen.
 */
export function KeyHint({ children, rows = 1, className }: KeyHintProps) {
  return (
    <div
      className={clsx(
        "not-lg:hidden col-2 relative flex items-center justify-center p-1",
        SPANS[rows],
        className,
      )}
    >
      <BracketBackground className="absolute inset-0" />
      <kbd className="relative z-0">{children}</kbd>
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

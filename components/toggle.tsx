import { clsx } from "clsx/lite";

import { Check, Icon } from "#/components/icons.tsx";

type ToggleProps = {
  label: string;
  pressed: boolean;
  /** Where toggling goes — the toggle's state lives in the URL. */
  href: string;
  className?: string;
};

/** An on/off toggle whose state is a URL: a link, so it works without JS. */
export function Toggle({ label, pressed, href, className }: ToggleProps) {
  return (
    <a
      href={href}
      role="button"
      aria-pressed={pressed}
      className={clsx(
        "inline-flex items-center gap-1 rounded-1 border px-fl-1 py-1 text-1 no-underline transition-colors",
        pressed
          ? "border-text-1 bg-surface-3 text-text-1"
          : "border-surface-4 text-text-2 hover:border-text-2 hover:text-text-1",
        className,
      )}
    >
      {pressed && <Icon icon={Check} />}
      {label}
    </a>
  );
}

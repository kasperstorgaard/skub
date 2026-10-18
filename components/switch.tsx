import { clsx } from "clsx/lite";

type SwitchProps = {
  label: string;
  checked: boolean;
  /** Where toggling goes — the switch's state lives in the URL. */
  href: string;
  className?: string;
};

/** An on/off switch whose state is a URL: a link, so it works without JS. */
export function Switch({ label, checked, href, className }: SwitchProps) {
  return (
    <a
      href={href}
      role="switch"
      aria-checked={checked}
      className={clsx(
        "group inline-flex items-center gap-fl-1 text-1 text-text-2 no-underline",
        "hover:text-text-1",
        className,
      )}
    >
      {label}
      <span
        className={clsx(
          "relative inline-flex w-10 h-6 shrink-0 rounded-round transition-colors",
          checked ? "bg-brand" : "bg-surface-3 group-hover:bg-surface-4",
        )}
      >
        <span
          className={clsx(
            "absolute top-1 left-1 size-4 rounded-round bg-surface-1 shadow-2 transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </a>
  );
}

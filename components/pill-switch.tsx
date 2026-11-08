import clsx from "clsx/lite";

type PillSwitchProps = {
  /** What the switch picks, for screen readers */
  label: string;
  items: { label: string; href: string; isActive: boolean }[];
  className?: string;
};

/** A pill switch of links: what it picks lives in the URL. */
export function PillSwitch({ label, items, className }: PillSwitchProps) {
  return (
    <nav
      aria-label={label}
      className={clsx(
        "inline-flex gap-1 p-1 rounded-round bg-surface-2",
        className,
      )}
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.isActive ? "page" : undefined}
          // Active: a raised segment, not a button
          className={clsx(
            "px-3 py-1 rounded-round text-1 no-underline whitespace-nowrap",
            item.isActive
              ? "bg-surface-3 text-text-1"
              : "text-text-2 hover:text-text-1",
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

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
        "inline-flex p-1 rounded-round bg-surface-2",
        className,
      )}
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.isActive ? "page" : undefined}
          // Active: an action button's ring and tint, sized down to a pill.
          // The other keeps a clear border as wide, so it's as tall, and
          // half the padding towards the active one.
          className={clsx(
            // Taller on mobile, for thumbs
            "py-1 max-lg:py-2 rounded-round",
            "text-1 no-underline whitespace-nowrap",
            item.isActive
              ? "btn px-3 min-h-0 min-w-0 font-normal tracking-normal"
              : clsx(
                "first:pl-2 first:pr-1 last:pl-1 last:pr-2",
                "border-[3px] border-transparent",
                "text-text-2 hover:text-text-1",
              ),
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

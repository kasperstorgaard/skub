import { clsx } from "clsx/lite";

type PanelProps = preact.HTMLAttributes<HTMLElement>;

/**
 * Shared panel component for sidebars
 * - Mobile/tablet: Bottom panel spanning full width
 * - Large screens: Fixed right sidebar
 */
export function Panel({ children, className }: PanelProps) {
  return (
    <aside
      className={clsx(
        "panel col-span-3 grid grid-cols-subgrid place-content-start max-md:min-h-[min(30dvh,20rem)]",
        "border-t border-brand bg-surface-2 py-fl-4",
        "max-md:text-fl-1",
        "lg:col-start-2 lg:col-span-1 lg:grid-rows-subgrid lg:row-span-full lg:px-fl-2",
        className,
      )}
    >
      {children}
    </aside>
  );
}

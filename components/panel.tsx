import { clsx } from "clsx/lite";

import { PanelCredits } from "#/components/panel-credits.tsx";

type PanelProps = {
  children?: preact.ComponentChildren;
  /** Drop the builder link, e.g. while building */
  hideBuilder?: boolean;
  className?: string;
};

/**
 * Shared panel component for sidebars
 * - Mobile/tablet: Bottom panel spanning full width
 * - Large screens: Fixed right sidebar
 */
export function Panel({ children, hideBuilder, className }: PanelProps) {
  return (
    <aside
      className={clsx(
        "panel col-span-3 grid grid-cols-subgrid place-content-start max-md:min-h-[min(30dvh,20rem)]",
        "border-t border-brand bg-panel py-fl-4",
        "max-md:text-fl-1",
        "lg:col-start-2 lg:col-span-1 lg:grid-rows-subgrid lg:row-span-full lg:px-fl-2",
        className,
      )}
    >
      {children}

      {
        /* Credits and the builder: mobile a row at the foot, a group step under
          the content; desktop the builder on top, credits at the foot */
      }
      <PanelCredits hideBuilder={hideBuilder} className="not-first:mt-fl-4" />
    </aside>
  );
}

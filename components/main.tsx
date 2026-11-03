import { clsx } from "clsx/lite";
import { ComponentChildren } from "preact";

type MainProps = {
  children: ComponentChildren;
  className?: string;
};

/**
 * Shared component for main content
 */
export function Main({ children, className }: MainProps) {
  return (
    <main
      className={clsx(
        "grid grid-rows-subgrid row-span-3 col-[2/3] w-full gap-fl-2 py-fl-2 place-content-center",
        "lg:col-[1/2] lg:mx-auto lg:max-w-lg lg:self-end lg:row-span-full lg:pb-fl-2",
        "print:mt-fl-3",
        className,
      )}
    >
      {children}
    </main>
  );
}

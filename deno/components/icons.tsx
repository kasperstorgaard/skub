/**
 * Custom Icons wrapper, since none of the phosphor packages are great for preact + Deno.
 * TODO: extract this to a new github repo as community phosphor package
 */
import clsx from "clsx/lite";

type Props = {
  icon: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Renders a Phosphor icon as an inline SVG.
 * Icons scale with the current `font-size` via `width/height: 1em`.
 */
export function Icon({ icon, className, "aria-label": label }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 256 256"
      fill="currentColor"
      className={clsx("inline align-middle max-w-none", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      // deno-lint-ignore react-no-danger
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  );
}

export * from "#/components/icons/index.ts";

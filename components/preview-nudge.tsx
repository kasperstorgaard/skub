import clsx from "clsx/lite";

import { Icon, PaperPlaneTilt } from "#/components/icons.tsx";

type Props = {
  className?: string;
};

/** Under the preview's board: sending it in, back in the editor. */
export function PreviewNudge({ className }: Props) {
  return (
    <aside
      className={clsx(
        "flex flex-col place-content-center gap-2 p-2 px-3",
        "text-text-2 text-pretty",
        "animate-fade-in",
        className,
      )}
    >
      <p className="min-w-[16ch] text-center leading-snug">
        Happy with it?
      </p>

      <a href="/puzzles/build?submit=compose" className="btn">
        <Icon icon={PaperPlaneTilt} />
        Send it in
      </a>
    </aside>
  );
}

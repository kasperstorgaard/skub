import clsx from "clsx/lite";

import { ChatCircleDots, Icon } from "#/components/icons.tsx";

type Props = {
  /** The page the rating dialog opens over. */
  url: URL;
  className?: string;
};

/** Asks a player who solved the puzzle, and hasn't rated it, how it was. */
export function RateNudge({ url, className }: Props) {
  const rateUrl = new URL(url);
  rateUrl.searchParams.set("dialog", "feedback");
  rateUrl.searchParams.set("from", "nudge");

  return (
    <aside
      className={clsx(
        "flex flex-col place-content-center gap-2 p-2 px-3",
        "text-text-2 text-pretty",
        className,
      )}
    >
      <p className="min-w-[16ch] text-center leading-snug">
        How was it?
      </p>

      <a href={rateUrl.href} data-router className="btn">
        <Icon icon={ChatCircleDots} /> Rate it
      </a>
    </aside>
  );
}

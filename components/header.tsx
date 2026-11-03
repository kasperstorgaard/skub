import clsx from "clsx/lite";

import { BuilderIcon } from "#/components/builder-icon.tsx";
import { ArrowLeft, Icon, UserCircle } from "#/components/icons.tsx";
import { ShareButton } from "#/islands/share-button.tsx";

type Props = {
  url: URL;
  back?: { href: string };
  share?: boolean | { params: boolean };
  /** Link to the puzzle builder */
  build?: boolean;
  hideProfile?: boolean;
};

export function Header({ url, back, share, build, hideProfile }: Props) {
  const shareUrl = typeof share === "object" && share.params
    ? url.href
    : url.origin + url.pathname;

  return (
    <header
      f-client-nav
      className="print:hidden flex items-center justify-between text-5 text-text-2"
    >
      {back && (
        <a
          href={back.href}
          className={clsx(
            "inline-flex items-center justify-center min-w-[44px] min-h-[44px]",
            "text-5 no-underline text-inherit hover:text-link",
          )}
          aria-label="Back"
        >
          <Icon icon={ArrowLeft} />
        </a>
      )}
      <div className="flex items-center ml-auto">
        {share && <ShareButton url={shareUrl} />}
        {build && (
          <a
            href="/puzzles/new"
            className={clsx(
              "inline-flex items-center justify-center min-w-[44px] min-h-[44px] -mr-[2px]",
              "no-underline text-inherit text-5 hover:text-link",
            )}
            aria-label="Build a puzzle"
            title="Build a puzzle"
          >
            <BuilderIcon />
          </a>
        )}
        {!hideProfile && (
          <a
            href="/profile"
            className={clsx(
              "inline-flex items-center justify-center min-w-[44px] min-h-[44px]",
              "no-underline text-inherit text-5 hover:text-link",
            )}
            aria-label="Profile and settings"
          >
            <Icon icon={UserCircle} />
          </a>
        )}
      </div>
    </header>
  );
}

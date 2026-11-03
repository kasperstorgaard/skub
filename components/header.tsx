import clsx from "clsx/lite";

import { BuilderIcon } from "#/components/builder-icon.tsx";
import { ArrowLeft, Icon, UserCircle } from "#/components/icons.tsx";

type Props = {
  back?: { href: string };
  /** Hide the puzzle builder link, e.g. on the builder itself */
  hideBuild?: boolean;
  hideProfile?: boolean;
};

export function Header({ back, hideBuild, hideProfile }: Props) {
  return (
    <header
      f-client-nav
      className="print:hidden flex items-center justify-between mb-fl-2 text-5 text-text-2"
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
        {!hideBuild && (
          <a
            href="/puzzles/new"
            // Full navigation: /puzzles/new redirects, which client nav drops
            f-client-nav={false}
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

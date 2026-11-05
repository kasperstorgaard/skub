import clsx from "clsx/lite";

import { ArrowLeft, Icon, UserCircle } from "#/components/icons.tsx";

type Props = {
  back?: { href: string };
  hideProfile?: boolean;
};

export function Header({ back, hideProfile }: Props) {
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

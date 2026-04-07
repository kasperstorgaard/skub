import clsx from "clsx/lite";

import { Icon, Play } from "#/components/icons.tsx";

type Props = {
  showMeUrl: URL;
  className?: string;
};

export function TutorialWatchButton({ showMeUrl, className }: Props) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center place-content-center gap-fl-1",
        "text-center text-text-2",
        "animate-fade-in",
        className,
      )}
    >
      <p className="leading-flat text-fl-min lg:hidden">
        Rather watch?
      </p>
      <p className="leading-flat text-fl-min max-lg:hidden">
        Rather watch a solve?
      </p>
      <a href={showMeUrl.href} className="btn shadow-sm">
        <Icon icon={Play} /> Show me
      </a>
    </div>
  );
}

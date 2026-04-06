import type { Signal } from "@preact/signals";
import clsx from "clsx/lite";
import { useMemo } from "preact/hooks";

import { Icon, Play } from "#/components/icons.tsx";
import { decodeState } from "#/game/url.ts";

type Props = {
  href: Signal<string>;
  showMeUrl: URL;
  className?: string;
};

export function TutorialWatchButton({ href, showMeUrl, className }: Props) {
  const state = useMemo(() => decodeState(href.value), [href.value]);

  if (state.moves.length <= 3) return null;

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

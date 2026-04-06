import clsx from "clsx/lite";

import { ChalkboardTeacher, Icon } from "#/components/icons.tsx";

type Props = {
  className?: string;
};

export function TutorialNudge({ className }: Props) {
  return (
    <div
      className={clsx(
        "flex flex-col place-content-center gap-fl-1 p-2 px-3",
        "text-text-2 text-pretty",
        "animate-fade-in",
        className,
      )}
    >
      <p className="gap-1 min-w-[16ch] text-center leading-snug">
        Tip: use blockers <IconBlocker /> to stop the puck <IconPuck />{" "}
        mid-slide
      </p>

      <a href="/puzzles/tutorial" className="btn">
        Learn the basics
      </a>
    </div>
  );
}

function IconBlocker() {
  return (
    <svg viewBox="0 0 50 50" className="inline size-[1em] align-[-0.125em]">
      <rect
        x="5"
        y="5"
        width="40"
        height="40"
        rx="6"
        ry="6"
        fill="var(--color-ui-3)"
      />
    </svg>
  );
}

function IconPuck() {
  return (
    <svg viewBox="0 0 50 50" className="inline size-[1em] align-[-0.125em]">
      <circle cx="25" cy="25" r="20" fill="var(--color-ui-2)" />
    </svg>
  );
}

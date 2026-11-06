import clsx from "clsx/lite";

import { ChalkboardTeacher, Icon } from "#/components/icons.tsx";

type Props = {
  className?: string;
};

export function TutorialNudge({ className }: Props) {
  return (
    <aside
      className={clsx(
        "grid grid-cols-[minmax(min(100%,var(--width-action)),max-content)] justify-center gap-fl-1 py-2",
        "text-text-2 text-pretty",
        "animate-fade-in",
        className,
      )}
    >
      <p className="contain-inline-size gap-1 text-center text-balance leading-snug">
        Tip: click and move blockers <IconBlocker /> to stop the puck{" "}
        <IconPuck /> mid-slide
      </p>

      <a href="/puzzles/tutorial" className="btn">
        <Icon icon={ChalkboardTeacher} /> Learn the basics
      </a>
    </aside>
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

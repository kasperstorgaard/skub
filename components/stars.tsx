import { clsx } from "clsx/lite";
import type { ComponentChildren } from "preact";

import type { ScoreKind } from "#/game/score.ts";

// One rounded star on Phosphor's 256 grid. The kinds differ only in how it's
// drawn: outline for solve, filled for perfect, a faded fill for first, and the
// outline dashed, gaps at the corners, for Flash.
const STAR =
  "M121.3,45.6 Q128.0,32.0 134.7,45.6 L154.9,86.5 Q158.6,93.9 166.8,95.1 L211.9,101.7 Q226.9,103.9 216.0,114.5 L183.4,146.3 Q177.5,152.1 178.9,160.2 L186.6,205.2 Q189.1,220.1 175.7,213.1 L135.3,191.9 Q128.0,188.0 120.7,191.9 L80.3,213.1 Q66.9,220.1 69.4,205.2 L77.1,160.2 Q78.5,152.1 72.6,146.3 L40.0,114.5 Q29.1,103.9 44.1,101.7 L89.2,95.1 Q97.4,93.9 101.1,86.5 Z";
const FLASH_DASH = { array: "27.2 36.0", offset: -28.0 };

const LABELS: Record<ScoreKind, string> = {
  solve: "Solved",
  perfect: "Perfect",
  first: "First to find a path",
  flash: "Flash solved",
};

// A touch heavier than Phosphor's regular, and the gap the knock-out cuts.
const STROKE = 20;
const KNOCKOUT = 40;

type StarsProps = {
  /** Earned kinds, in display order. Nothing earned renders nothing. */
  kinds: ScoreKind[];
  className?: string;
};

/**
 * Earned stars in the theme's puck colour, stacked with an overlap, each over
 * the one before it. A star after the first cuts a gap out of the one behind in
 * `--star-knockout`, which the container sets to its own background; the page
 * surface otherwise.
 */
export function Stars({ kinds, className }: StarsProps) {
  if (kinds.length === 0) return null;
  const label = kinds.map((kind) => LABELS[kind]).join(", ");

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={clsx("inline-flex items-center text-ui-2", className)}
    >
      {kinds.map((kind, i) => (
        <svg
          key={kind}
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 256 256"
          aria-hidden="true"
          className="overflow-visible not-first:-ml-[0.35em]"
          stroke-linejoin="round"
        >
          {/* The first star has nothing behind it to cut into. */}
          {i > 0 && (
            <path
              d={STAR}
              fill="var(--star-knockout, var(--color-surface-1))"
              stroke="var(--star-knockout, var(--color-surface-1))"
              stroke-width={STROKE + KNOCKOUT}
            />
          )}
          <StarPath kind={kind} />
        </svg>
      ))}
    </span>
  );
}

function StarPath({ kind }: { kind: ScoreKind }) {
  const props = {
    d: STAR,
    stroke: "currentColor",
    "stroke-width": STROKE,
    "stroke-linecap": "round" as const,
  };

  switch (kind) {
    case "solve":
      return <path {...props} fill="none" />;
    case "perfect":
      return <path {...props} fill="currentColor" />;
    case "first":
      return <path {...props} fill="currentColor" fill-opacity="0.35" />;
    case "flash":
      return (
        <path
          {...props}
          fill="none"
          stroke-dasharray={FLASH_DASH.array}
          stroke-dashoffset={FLASH_DASH.offset}
        />
      );
  }
}

type BadgeStarsProps = {
  kinds?: ScoreKind[];
  children: ComponentChildren;
};

/** The player's stars floating left of a score badge, no background. */
export function BadgeStars({ kinds = [], children }: BadgeStarsProps) {
  return (
    <span className="flex items-center gap-2">
      <Stars kinds={kinds} className="text-5 lg:text-4" />
      {children}
    </span>
  );
}

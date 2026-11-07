import { clsx } from "clsx/lite";
import type { ComponentChildren } from "preact";

import type { ScoreKind } from "#/game/score.ts";

// One rounded star on Phosphor's 256 grid, drawn three ways: an outline for
// solve, filled with tiny rays between its arms for perfect, and as a dashed
// path into its centre for first. A Flash solve is the solve star in the Flash colour.
const STAR =
  "M121.3,45.6 Q128.0,32.0 134.7,45.6 L154.9,86.5 Q158.6,93.9 166.8,95.1 L211.9,101.7 Q226.9,103.9 216.0,114.5 L183.4,146.3 Q177.5,152.1 178.9,160.2 L186.6,205.2 Q189.1,220.1 175.7,213.1 L135.3,191.9 Q128.0,188.0 120.7,191.9 L80.3,213.1 Q66.9,220.1 69.4,205.2 L77.1,160.2 Q78.5,152.1 72.6,146.3 L40.0,114.5 Q29.1,103.9 44.1,101.7 L89.2,95.1 Q97.4,93.9 101.1,86.5 Z";
const RAYS =
  "M178.5,66.4 L188.0,53.5 M209.8,162.6 L225.0,167.5 M128.0,222.0 L128.0,238.0 M46.2,162.6 L31.0,167.5 M77.5,66.4 L68.0,53.5";
// First is a path, drawn like a G: round the star from an inner corner, open
// before getting back to it, then straight in to the centre, in eight dashes.
const FIRST_PATH =
  "M181.0,172.5 L186.6,205.2 Q189.1,220.1 175.7,213.1 L135.3,191.9 Q128.0,188.0 120.7,191.9 L80.3,213.1 Q66.9,220.1 69.4,205.2 L77.1,160.2 Q78.5,152.1 72.6,146.3 L40.0,114.5 Q29.1,103.9 44.1,101.7 L89.2,95.1 Q97.4,93.9 101.1,86.5 L121.3,45.6 Q128.0,32.0 134.7,45.6 L154.9,86.5 Q158.6,93.9 166.8,95.1 L211.9,101.7 Q226.9,103.9 216.0,114.5 L204.7,125.6 L128.0,140.0";
const FIRST_DASH = "51.9 34.0";

const DISPLAY_ORDER: ScoreKind[] = ["solve", "flash", "perfect", "first"];

const LABELS: Record<ScoreKind, string> = {
  solve: "Solved",
  perfect: "Perfect",
  first: "First to find a path",
  flash: "Solved from the Flash start",
};

// A touch heavier than Phosphor's regular, and the gap the knock-out cuts.
const STROKE = 20;
const KNOCKOUT = 64;

type StarsProps = {
  /** Earned kinds. Nothing earned renders nothing. */
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
  // Flash stands in for solve, so it takes the solve star's place.
  const stars = [...kinds].sort((a, b) =>
    DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b)
  );
  const label = stars.map((kind) => LABELS[kind]).join(", ");

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={clsx("inline-flex items-center text-ui-2", className)}
    >
      {stars.map((kind, i) => (
        <svg
          key={kind}
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 256 256"
          aria-hidden="true"
          className="overflow-visible not-first:-ml-[0.3em]"
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
    case "flash":
      return <path {...props} fill="none" className="text-ui-1" />;
    case "perfect":
      return (
        <>
          <path {...props} fill="currentColor" />
          <path {...props} d={RAYS} fill="none" stroke-width={STROKE * 0.6} />
        </>
      );
    case "first":
      return (
        <path
          {...props}
          d={FIRST_PATH}
          fill="none"
          stroke-dasharray={FIRST_DASH}
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

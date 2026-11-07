import { clsx } from "clsx/lite";
import type { ComponentChildren } from "preact";
import { useId } from "preact/hooks";

import type { ScoreKind } from "#/game/score.ts";

// One rounded star on Phosphor's 256 grid, drawn three ways: an outline for
// solve, filled with tiny rays between its arms for perfect, and dashed for
// first. A Flash solve is the solve star in the pearl, Flash's own look.
const STAR =
  "M121.3,45.6 Q128.0,32.0 134.7,45.6 L154.9,86.5 Q158.6,93.9 166.8,95.1 L211.9,101.7 Q226.9,103.9 216.0,114.5 L183.4,146.3 Q177.5,152.1 178.9,160.2 L186.6,205.2 Q189.1,220.1 175.7,213.1 L135.3,191.9 Q128.0,188.0 120.7,191.9 L80.3,213.1 Q66.9,220.1 69.4,205.2 L77.1,160.2 Q78.5,152.1 72.6,146.3 L40.0,114.5 Q29.1,103.9 44.1,101.7 L89.2,95.1 Q97.4,93.9 101.1,86.5 Z";
const RAYS =
  "M178.5,66.4 L188.0,53.5 M209.8,162.6 L225.0,167.5 M128.0,222.0 L128.0,238.0 M46.2,162.6 L31.0,167.5 M77.5,66.4 L68.0,53.5";
// First is the outline in thirteen even dashes that fall where they
// fall rather than lining up with the tips.
const FIRST_DASH = { array: "20.7 28.0", offset: 14 };

const DISPLAY_ORDER: ScoreKind[] = ["solve", "flash", "perfect", "first"];

const LABELS: Record<ScoreKind, string> = {
  solve: "Solved",
  perfect: "Perfect",
  first: "First to find a path",
  flash: "Solved from the Flash start",
};

// A touch slimmer than Phosphor's regular, and the gap the knock-out cuts.
const STROKE = 14;
const KNOCKOUT = 64;

type StarsProps = {
  /** Earned kinds. Nothing earned renders nothing. */
  kinds: ScoreKind[];
  className?: string;
  style?: Record<string, string>;
};

/**
 * Earned stars in the theme's puck colour, stacked with an overlap, each over
 * the one before it. A star after the first cuts a gap out of the one behind in
 * `--star-knockout`, which the container sets to its own background; the page
 * surface otherwise.
 */
export function Stars({ kinds, className, style }: StarsProps) {
  const id = useId();
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
      style={style}
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
          <StarPath kind={kind} id={id} />
        </svg>
      ))}
    </span>
  );
}

function StarPath({ kind, id }: { kind: ScoreKind; id: string }) {
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
      return (
        <>
          <PearlGradients id={id} />
          <path {...props} fill="none" stroke={`url(#${id}-pearl)`} />
          <path {...props} fill="none" stroke={`url(#${id}-sheen)`} />
        </>
      );
    case "perfect":
      return (
        <>
          <path {...props} fill="currentColor" />
          <path {...props} d={RAYS} fill="none" stroke-width={STROKE * 0.75} />
        </>
      );
    case "first":
      return (
        <path
          {...props}
          fill="none"
          stroke-dasharray={FIRST_DASH.array}
          stroke-dashoffset={FIRST_DASH.offset}
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

/**
 * `--pearl` as SVG gradients, which a stroke can take: brand and link at
 * 115deg, under a soft highlight top left. Placed on the star's box.
 */
function PearlGradients({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient
        id={`${id}-pearl`}
        gradientUnits="userSpaceOnUse"
        x1="38"
        y1="86"
        x2="218"
        y2="166"
      >
        <stop offset="0" style={{ stopColor: "var(--color-brand)" }} />
        <stop offset="0.45" style={{ stopColor: "var(--color-link)" }} />
        <stop offset="0.75" style={{ stopColor: "var(--color-brand)" }} />
        <stop offset="1" style={{ stopColor: "var(--color-link)" }} />
      </linearGradient>
      <radialGradient
        id={`${id}-sheen`}
        gradientUnits="userSpaceOnUse"
        cx="78"
        cy="51"
        r="125"
      >
        <stop offset="0" stop-color="white" stop-opacity="0.5" />
        <stop offset="0.55" stop-color="white" stop-opacity="0" />
      </radialGradient>
    </defs>
  );
}

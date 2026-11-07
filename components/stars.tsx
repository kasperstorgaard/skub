import { clsx } from "clsx/lite";
import type { ComponentChildren } from "preact";

import type { ScoreKind } from "#/game/score.ts";

// Each kind's star on Phosphor's 256 grid: the solve star's outline, a
// filled star with rays between its arms for perfect, a filled one with
// sparkles for first, and the outline dashed for Flash.
const GLYPHS = {
  solve: [
    {
      d: "M128.0,36.0 L152.7,102.0 L223.1,105.1 L167.9,149.0 L186.8,216.9 L128.0,178.0 L69.2,216.9 L88.1,149.0 L32.9,105.1 L103.3,102.0 Z",
      style: "outline",
    },
  ],
  perfect: [
    {
      d: "M128.0,50.0 L148.7,105.5 L207.9,108.0 L161.6,144.9 L177.4,202.0 L128.0,169.3 L78.6,202.0 L94.4,144.9 L48.1,108.0 L107.3,105.5 Z",
      style: "fill",
    },
    {
      d: "M179.7,62.8 L195.0,41.8 M211.7,161.2 L236.4,169.2 M128.0,222.0 L128.0,248.0 M44.3,161.2 L19.6,169.2 M76.3,62.8 L61.0,41.8",
      style: "line",
    },
  ],
  first: [
    {
      d: "M116.0,56.0 L137.7,114.1 L199.7,116.8 L151.2,155.4 L167.7,215.2 L116.0,181.0 L64.3,215.2 L80.8,155.4 L32.3,116.8 L94.3,114.1 Z",
      style: "fill",
    },
    {
      d: "M204.0,20.0 Q204.0,56.0 240.0,56.0 Q204.0,56.0 204.0,92.0 Q204.0,56.0 168.0,56.0 Q204.0,56.0 204.0,20.0 Z",
      style: "fill",
    },
    {
      d: "M220.0,114.0 Q220.0,132.0 238.0,132.0 Q220.0,132.0 220.0,150.0 Q220.0,132.0 202.0,132.0 Q220.0,132.0 220.0,114.0 Z",
      style: "fill",
    },
  ],
  flash: [
    {
      d: "M128.0,36.0 L152.7,102.0 L223.1,105.1 L167.9,149.0 L186.8,216.9 L128.0,178.0 L69.2,216.9 L88.1,149.0 L32.9,105.1 L103.3,102.0 Z",
      style: "dashed",
    },
  ],
} as const;

// A dash centred on each point and inner corner of the Flash star.
const FLASH_DASH = { array: "42.3 28.2", offset: 21.1 };

type Part = { d: string; style: "outline" | "fill" | "line" | "dashed" };

const LABELS: Record<ScoreKind, string> = {
  solve: "Solved",
  perfect: "Perfect",
  first: "First to find a path",
  flash: "Flash solved",
};

// Phosphor's regular weight, and the gap the knock-out cuts around a star.
const STROKE = 16;
const KNOCKOUT = 40;

type StarsProps = {
  /** Earned kinds, in display order. Nothing earned renders nothing. */
  kinds: ScoreKind[];
  className?: string;
};

/**
 * Earned stars, stacked with an overlap, each over the one before it. A star
 * cuts a gap out of the one behind in `--star-knockout`, which the container
 * sets to its own background; the page surface otherwise.
 */
export function Stars({ kinds, className }: StarsProps) {
  if (kinds.length === 0) return null;
  const label = kinds.map((kind) => LABELS[kind]).join(", ");

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={clsx("inline-flex items-center", className)}
    >
      {kinds.map((kind) => (
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
          <g
            fill="var(--star-knockout, var(--color-surface-1))"
            stroke="var(--star-knockout, var(--color-surface-1))"
          >
            {GLYPHS[kind].map((part) => (
              <StarPart part={part} width={STROKE + KNOCKOUT} />
            ))}
          </g>
          <g fill="currentColor" stroke="currentColor">
            {GLYPHS[kind].map((part) => (
              <StarPart
                part={part}
                width={STROKE}
              />
            ))}
          </g>
        </svg>
      ))}
    </span>
  );
}

function StarPart({ part, width }: { part: Part; width: number }) {
  switch (part.style) {
    case "fill":
      return <path d={part.d} stroke-width={width} />;
    case "outline":
      return <path d={part.d} fill="none" stroke-width={width} />;
    case "line":
      return (
        <path
          d={part.d}
          fill="none"
          stroke-width={width}
          stroke-linecap="round"
        />
      );
    case "dashed":
      // The knock-out follows the whole outline, so the gaps stay cut too.
      return width > STROKE
        ? <path d={part.d} fill="none" stroke-width={width} />
        : (
          <path
            d={part.d}
            fill="none"
            stroke-width={width}
            stroke-linecap="round"
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

/**
 * The player's stars floating left of a score badge, no background: teal, or
 * yellow once perfect, as on the cards.
 */
export function BadgeStars({ kinds = [], children }: BadgeStarsProps) {
  return (
    <span className="flex items-center gap-2">
      <Stars
        kinds={kinds}
        className={clsx(
          "text-5 lg:text-4",
          kinds.includes("perfect") ? "text-ui-2" : "text-ui-1",
        )}
      />
      {children}
    </span>
  );
}

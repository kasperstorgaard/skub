import clsx from "clsx/lite";

/**
 * Ring insets as percentages of the container, outermost first. The negative
 * ones run past its corners, to be cropped by the overflow.
 *
 * They stop well before the middle: once a circle is small enough that one side
 * of its border holds less than a single dash, a browser draws the four sides as
 * four strokes and the ring reads as a cross rather than a circle. A solid core
 * fills the centre instead.
 */
const CELL_RINGS = [-22, -16, -10, -4, 2, 8, 14, 20];
const CELL_CORE = 40;

// A toolbar swatch is a quarter of a cell, so far fewer bands fit above that
// same limit.
const ICON_RINGS = [-25, -5, 15];
const ICON_CORE = 38;

type PortalRingsProps = {
  /** Renders the sparser set that survives being drawn at swatch size. */
  compact?: boolean;
};

/**
 * The portal's churning rings, shared so the board and the editor's swatch
 * cannot drift apart.
 *
 * Each ring paints over the last one's interior, so all that stays visible is
 * its dashed band — and the gaps between dashes show the ring's own fill, which
 * is what makes the dash two-coloured rather than see-through. They turn a
 * little faster toward the centre.
 *
 * Expects a positioned, overflow-hidden parent.
 */
export function PortalRings({ compact }: PortalRingsProps) {
  const rings = compact ? ICON_RINGS : CELL_RINGS;

  return (
    <>
      {rings.map((inset, index) => (
        <div
          key={inset}
          className={clsx(
            "absolute rounded-round border-dashed border-portal bg-portal-alt",
            compact ? "border-1" : "border-2",
          )}
          style={{
            inset: `${inset}%`,
            animation: `spin ${48 - index * 3.6}s linear infinite`,
          }}
        />
      ))}

      {/* A small dark eye, so the middle reads as somewhere to fall into. */}
      <div
        className="absolute rounded-round bg-hole"
        style={{ inset: `${compact ? ICON_CORE : CELL_CORE}%` }}
      />
    </>
  );
}

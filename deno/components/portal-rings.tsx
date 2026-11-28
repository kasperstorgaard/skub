import clsx from "clsx/lite";

/**
 * Ring insets as percentages of the container, outermost first. The negative
 * ones run past its corners, to be cropped by the overflow.
 *
 * The innermost circles are small enough that one side of the border holds less
 * than a dash, so a browser draws the four sides as four strokes and they read
 * as a cross rather than a ring. Kept anyway: rings packed the whole way in look
 * better than a tidy centre.
 */
const CELL_RINGS = [-22, -16, -10, -4, 2, 8, 14, 20, 26, 32, 38, 44];

// A toolbar swatch is a quarter of a cell, so far fewer bands fit.
const ICON_RINGS = [-25, -8, 9, 26];

type PortalRingsProps = {
  /** Renders the sparser set that fits a swatch. */
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
    </>
  );
}

import { clsx } from "clsx/lite";

import { Icon, Star, StarFill, StarHalfFill } from "#/components/icons.tsx";

type StarRatingProps = {
  label: string;
  /** Current rating 0.5–5 in half steps, or undefined when unrated. */
  value?: number;
  /** Fires with the new rating, or undefined when the rating is cleared. */
  onChange: (value: number | undefined) => void;
};

const STARS = [1, 2, 3, 4, 5];

/** Renders a rating as text — "3.5", not "3.50", and no trailing ".0". */
const format = (value: number) => String(value);

/**
 * Five-star quality rating in half-star steps. Each star has two hit targets:
 * its left half sets the half value, its right half the whole one. Clicking the
 * current rating again clears it. Fill-weight (brand) up to the value, outline
 * (muted) beyond — shape + colour, so the selection reads without colour vision.
 *
 * Halves exist because whole stars weren't enough resolution to rate generated
 * candidates: "3.5" kept ending up written in the note field instead.
 */
export function StarRating({ label, value, onChange }: StarRatingProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-fl-0 text-text-2">{label}</span>

      <div className="flex items-center gap-1 text-3">
        {STARS.map((star) => {
          const half = star - 0.5;
          const filled = value !== undefined && value >= star;
          const halfFilled = value !== undefined && value >= half && !filled;

          return (
            <span
              key={star}
              className="group relative inline-flex leading-none"
            >
              <Icon
                icon={filled ? StarFill : halfFilled ? StarHalfFill : Star}
                className={filled || halfFilled
                  ? "text-brand"
                  : "text-text-3 group-hover:text-text-2"}
              />

              {[half, star].map((rating, index) => (
                <button
                  key={rating}
                  type="button"
                  className={clsx(
                    "absolute inset-y-0 w-1/2 cursor-pointer",
                    // Invisible hit target over the star it rates — without the
                    // reset these are UA-chrome buttons covering the icon.
                    "appearance-none bg-transparent border-none p-0 rounded-none",
                    index === 0 ? "left-0" : "right-0",
                  )}
                  aria-label={`${format(rating)} star${
                    rating === 1 ? "" : "s"
                  }`}
                  aria-pressed={rating === value}
                  onClick={() =>
                    onChange(rating === value ? undefined : rating)}
                />
              ))}
            </span>
          );
        })}
      </div>
    </div>
  );
}

import { clsx } from "clsx/lite";

import { Icon, Star, StarFill } from "#/components/icons.tsx";

type StarRatingProps = {
  label: string;
  /** Current rating 1–5, or undefined when unrated. */
  value?: number;
  /** Fires with the new rating, or undefined when the rating is cleared. */
  onChange: (value: number | undefined) => void;
};

const STARS = [1, 2, 3, 4, 5];

/**
 * Five-star quality rating. Clicking a star sets the rating; clicking the
 * current rating again clears it. Fill-weight (brand) up to the value, outline
 * (muted) beyond — shape + colour, so the selection reads without colour vision.
 */
export function StarRating({ label, value, onChange }: StarRatingProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-fl-0 text-text-2">{label}</span>

      <div className="flex items-center gap-1 text-3">
        {STARS.map((star) => {
          const filled = value !== undefined && star <= value;
          return (
            <button
              key={star}
              type="button"
              className={clsx(
                "cursor-pointer leading-none",
                filled ? "text-brand" : "text-text-3 hover:text-text-2",
              )}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              aria-pressed={filled}
              onClick={() => onChange(star === value ? undefined : star)}
            >
              <Icon icon={filled ? StarFill : Star} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

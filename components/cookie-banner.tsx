import { clsx } from "clsx/lite";

type Props = {
  // Whether the banner should be shown (true when user hasn't made a choice).
  open: boolean;
};

/**
 * Cookie consent banner displayed at the bottom of the page.
 * Submits to /api/consent with action "accept" or "decline".
 */
export function CookieBanner({ open }: Props) {
  if (!open) return null;

  return (
    <div
      className={clsx(
        "cookie-banner fixed top-auto bottom-1 left-0 max-w-screen right-0 p-5 m-0 z-5",
        "grid gap-5 rounded-cond-2 overflow-hidden bg-surface-2",
        "sm:max-w-88 max-lg:shadow-3",
        "md:bottom-fl-2 md:left-fl-2 md:right-auto",
        "motion-safe:animate-slide-in-bottom motion-safe:md:animate-slide-in-left",
      )}
    >
      {/* A puck with a bite out of it, peeking in from the corner */}
      <svg
        className="absolute -top-4 -right-3 size-18 -z-1 opacity-80 pointer-events-none"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="cookie-bite">
            <path
              d="M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 M 15 60 a 15 15 0 1 0 0 0.01"
              fill-rule="evenodd"
            />
          </clipPath>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="var(--color-ui-2)"
          clip-path="url(#cookie-bite)"
        />
      </svg>

      <div className="grid gap-3">
        <h2 className="type-title text-pretty">
          Okay if I track?
        </h2>

        <p className="type-body text-pretty">
          It's just me building this thing,
          <br className="sm:hidden" /> so a little peek shows me what to fix.
          {" "}
          <a href="/cookie-policy" className="text-current">Cookie policy</a>
        </p>
      </div>

      <form action="/api/consent" method="POST" className="flex gap-fl-1">
        <button
          type="submit"
          name="action"
          value="decline"
          className="btn text-1"
        >
          No thanks
        </button>

        <button
          type="submit"
          name="action"
          value="accept"
          className="btn text-1"
        >
          Sure
        </button>
      </form>
    </div>
  );
}

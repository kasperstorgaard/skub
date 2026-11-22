import { signal } from "@preact/signals";

/**
 * The puzzle rated this page view, shared across islands as a module
 * singleton: `FeedbackDialog` writes it, `CelebrationDialog` reads it so that
 * puzzle's celebration goes back to Play one more. Sending doesn't reload the
 * page.
 */
export const ratedSlug = signal<string | null>(null);

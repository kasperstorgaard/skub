import { signal } from "@preact/signals";

/**
 * Whether feedback was sent this page view, shared across islands as a module
 * singleton: `FeedbackDialog` writes it, `CelebrationDialog` reads it so a
 * rated puzzle's celebration goes back to Play one more. Sending doesn't
 * reload the page.
 */
export const feedbackSent = signal(false);

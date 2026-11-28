import { signal } from "@preact/signals";

/**
 * Whether the Flash dialog was answered this page view, shared across islands
 * as a module singleton: `FlashDialog` writes it on "Not now", `FlashNudge`
 * reads it to step aside and `FlashSwitch` to skip the dialog. The cookie
 * behind it is httpOnly, and "Not now" doesn't reload the page.
 */
export const flashExplained = signal(false);

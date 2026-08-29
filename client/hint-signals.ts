import { signal } from "@preact/signals";

/**
 * Whether a hint has been spent this page view, shared as a module singleton in
 * the same way as `generator-signals` — `HintDialog` writes it when the hint
 * route answers, `ControlsPanel` reads it to retire the button.
 *
 * Needed because the hint count is an httpOnly cookie the client can't read,
 * and the enhanced path never reloads: it opens the dialog with `pushState`, so
 * the server-rendered count stays as it was when the page loaded.
 */
export const hintUsed = signal(false);

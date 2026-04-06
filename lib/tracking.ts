// Server-side tracking helpers that wrap posthog.capture calls.
// Each helper accepts ctx.state as its first argument so the repeated
// boilerplate (distinctId, $process_person_profile, $current_url) is
// derived automatically.
import type { State } from "#/core.ts";
import type { Move, Puzzle } from "#/game/types.ts";
import { posthog } from "#/lib/posthog.ts";

/**
 * Track a puzzle being solved for the first time by this user.
 */
export function trackPuzzleSolved(
  state: State,
  puzzle: Puzzle,
  options: { moves: Move[]; url: string },
): void {
  posthog?.capture({
    distinctId: state.trackingId,
    event: "puzzle_solved",
    properties: {
      $current_url: options.url,
      $process_person_profile: state.cookieChoice === "accepted",
      puzzle_slug: puzzle.slug,
      puzzle_difficulty: puzzle.difficulty,
      puzzle_min_moves: puzzle.minMoves,
      game_moves: options.moves.length,
    },
  });
}

/**
 * Track tutorial completion (triggered when finishing the last tutorial step).
 */
export function trackTutorialCompleted(
  state: State,
  puzzle: Puzzle,
  options: { moves: Move[]; url: string },
): void {
  posthog?.capture({
    distinctId: state.trackingId,
    event: "tutorial_completed",
    properties: {
      $current_url: options.url,
      $process_person_profile: state.cookieChoice === "accepted",
      puzzle_slug: puzzle.slug,
      game_moves: options.moves.length,
    },
  });
}

/**
 * Track player graduation (triggered on a sufficiently efficient first solve or when finishing "lone" puzzle).
 */
export function trackPlayerGraduated(
  state: State,
  puzzle: Puzzle,
  options: { moves: Move[]; url: string },
): void {
  posthog?.capture({
    distinctId: state.trackingId,
    event: "player_graduated",
    properties: {
      $current_url: options.url,
      $process_person_profile: state.cookieChoice === "accepted",
      puzzle_slug: puzzle.slug,
      puzzle_min_moves: puzzle.minMoves,
      game_moves: options.moves.length,
    },
  });
}

/**
 * Track a hint being requested. `cursor` is the number of moves already made.
 */
export function trackHintRequested(
  state: State,
  puzzle: Puzzle,
  options: { url: string; cursor?: number },
): void {
  posthog?.capture({
    distinctId: state.trackingId,
    event: "hint_requested",
    properties: {
      $current_url: options.url,
      $process_person_profile: state.cookieChoice === "accepted",
      puzzle_slug: puzzle.slug,
      puzzle_difficulty: puzzle.difficulty,
      puzzle_min_moves: puzzle.minMoves,
      game_moves: options.cursor,
    },
  });
}

/**
 * Track a cookie consent decision.
 *
 * NOTE: `$process_person_profile` is derived from `decision`, not from
 * `state.cookieChoice`, because the cookie has just been set and ctx.state
 * still reflects the incoming request value (null for new visitors).
 */
export function trackCookieConsent(
  state: State,
  options: { decision: "accepted" | "declined"; url: string },
): void {
  posthog?.capture({
    distinctId: state.trackingId,
    event: "cookie_consent",
    properties: {
      $current_url: options.url,
      $process_person_profile: options.decision === "accepted",
      decision: options.decision,
    },
  });
}

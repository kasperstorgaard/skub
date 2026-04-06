import {
  decodeMove,
  decodeMoves,
  decodePosition,
  encodeMove,
  encodeMoves,
  encodePosition,
} from "#/game/strings.ts";
import { DIFFICULTIES, Difficulty, Move, Position } from "#/game/types.ts";

// Dummy base for parsing relative URLs — never appears in output.
const BASE_URL = "http://example.com";

/**
 * All state needed to represent the current game
 */
export type GameState = {
  // What moves have been made
  moves: Move[];
  // What position is currently active/selected, if any
  active?: Position;
  // Current position in the move list (for undo/redo)
  // note: this allows for perfect undo/redo, as no state is lost.
  cursor?: number;
  // Optional hint move to show on the board
  hint?: Move;
};

/**
 * Encodes all the game state into URL parameters
 * @param state
 * @returns search params string
 */
export function encodeState({ moves, active, cursor, hint }: GameState) {
  const params = new URLSearchParams();

  if (moves.length) {
    params.set("moves", encodeMoves(moves));
  }

  if (active != null) {
    params.set("active", encodePosition(active));
  }

  if (cursor != null) {
    params.set("cursor", cursor.toString());
  }

  if (hint != null) {
    params.set("hint", encodeMove(hint));
  }

  return params.toString();
}

/**
 * Decodes the game state from URL parameters
 * @param urlOrHref
 * @returns Game state
 */
export function decodeState(urlOrHref: URL | string): GameState {
  const url = urlOrHref instanceof URL
    ? urlOrHref
    : new URL(urlOrHref, BASE_URL);
  const params = url.searchParams;

  const moveParam = params.get("moves");
  const moves = moveParam ? decodeMoves(moveParam) : [];

  const activeParam = params.get("active");
  const active = activeParam ? decodePosition(activeParam) : undefined;

  const cursorParam = params.get("cursor");
  const cursor = cursorParam ? parseInt(cursorParam) : undefined;

  const hintParam = params.get("hint");
  const hint = hintParam ? decodeMove(hintParam) : undefined;

  return {
    active,
    cursor: Number.isNaN(cursor) ? 0 : cursor,
    moves,
    hint,
  };
}

type GetMoveOptions = GameState & {
  href: string;
};

/**
 * Builds an href reflecting new moves applied at the current cursor position,
 * discarding any moves after the cursor (redo history).
 * Clears the hint.
 */
export function getMovesHref(
  newMoves: Move[],
  { href, moves, cursor }: GetMoveOptions,
) {
  const updatedMoves = [...moves.slice(0, cursor ?? moves.length), ...newMoves];
  const url = new URL(href, BASE_URL);

  url.search = encodeState({
    moves: updatedMoves,
    cursor: updatedMoves.length,
    active: newMoves[newMoves.length - 1][1],
  });

  return toRelative(url);
}

type GetActiveHrefOptions = GameState & { href: string };

/**
 * Builds an href with the given position set as the active (selected) piece.
 * Preserves all other state including any active hint.
 */
export function getActiveHref(
  active: Position,
  { href, ...state }: GetActiveHrefOptions,
) {
  const url = new URL(href, BASE_URL);

  url.search = encodeState({
    ...state,
    active,
  });

  return toRelative(url);
}

// Builds an href with the cursor moved back one step. Clears the hint.
export function getUndoHref(
  href: string,
  state: GameState,
) {
  const url = new URL(href, BASE_URL);
  const cursor = state.cursor != null
    ? Math.max(state.cursor - 1, 0)
    : state.moves.length - 2;

  url.search = encodeState({ ...state, cursor, hint: undefined });

  return toRelative(url);
}

// Builds an href with the cursor moved forward one step. Clears the hint.
export function getRedoHref(
  href: string,
  state: GameState,
) {
  const url = new URL(href, BASE_URL);
  const cursor = state.cursor != null
    ? Math.min(state.cursor + 1, state.moves.length)
    : state.moves.length;

  url.search = encodeState({ ...state, cursor, hint: undefined });

  return toRelative(url);
}

// Strips all game-state params (moves, active, cursor, hint) from the URL.
export function getResetHref(href: string) {
  const url = new URL(href, BASE_URL);

  url.searchParams.delete("active");
  url.searchParams.delete("cursor");
  url.searchParams.delete("moves");
  url.searchParams.delete("hint");
  url.searchParams.delete("dialog");

  return toRelative(url);
}

/**
 * Builds an href pointing to the server-side hint route for the current puzzle.
 * Extracts the puzzle slug from the pathname and redirects to `/puzzles/:slug/hint`.
 */
export function getHintHref(href: string) {
  const url = new URL(href, BASE_URL);
  const slugMatcher = /\/puzzles\/([^/]+)/;

  const matches = url.pathname.match(slugMatcher) ?? [];
  const slug = matches[1];

  if (!slug) throw new Error("Unable to get slug from URL");

  url.pathname = `/puzzles/${slug}/hint`;

  return toRelative(url);
}

/**
 * Builds an href pointing to the server-side solve route for the current puzzle.
 * Extracts the puzzle slug from the pathname and redirects to `/puzzles/:slug/solve`.
 */
export function getSolveHref(href: string) {
  const url = new URL(href, BASE_URL);
  const slugMatcher = /\/puzzles\/([^/]+)/;

  const matches = url.pathname.match(slugMatcher) ?? [];
  const slug = matches[1];

  if (!slug) throw new Error("Unable to get slug from URL");

  url.pathname = `/puzzles/${slug}/solve`;

  return toRelative(url);
}

// Reads the `replay_speed` search param from a URL
export function getReplaySpeed(urlOrHref: URL | string): number | null {
  const url = urlOrHref instanceof URL
    ? urlOrHref
    : new URL(urlOrHref, BASE_URL);

  const rawValue = url.searchParams.get("replay_speed");
  const value = parseFloat(rawValue ?? "");
  return isNaN(value) ? null : value;
}

// Reads the `difficulty` search param from a URL, returning a range
export function getDifficulty(
  urlOrHref: URL | string,
): Difficulty[] | null {
  const url = urlOrHref instanceof URL
    ? urlOrHref
    : new URL(urlOrHref, BASE_URL);
  const rawValue = url.searchParams.get("difficulty");

  if (!rawValue) return null;

  const values = rawValue?.split(",").filter((value) =>
    DIFFICULTIES.includes(value as Difficulty)
  );

  if (!values.length) return null;

  return values as Difficulty[];
}

// Reads the `page` search param from a URL
export function getPage(
  urlOrHref: URL | string,
) {
  const url = urlOrHref instanceof URL
    ? urlOrHref
    : new URL(urlOrHref, BASE_URL);
  const pageParam = url.searchParams.get("page");

  if (!pageParam) return null;

  const parsed = parseInt(pageParam, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
}

function toRelative(url: URL): string {
  return url.pathname + url.search;
}

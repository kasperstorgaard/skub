import { decodeState } from "#/game/url.ts";
import type { SolveTelemetry } from "#/lib/tracking.ts";

// Per-attempt solve signals, never surfaced and never rewarded. Module state
// survives the navigations each move triggers, so an attempt spans a solve.
type Attempt = {
  slug: string;
  /** Null until the first move — page-load time is not the start of a solve. */
  startedAt: number | null;
  /** The url already had moves when first seen, so the start went unobserved. */
  partial: boolean;
  moves: number;
  undos: number;
  redos: number;
  resets: number;
};

export type Snapshot = { moves: string; cursor: number };
export type Interaction = "move" | "undo" | "redo" | "reset";

let attempt: Attempt | null = null;
let lastSeen: Snapshot | null = null;

export function snapshot(href: string): Snapshot {
  const params = new URL(href).searchParams;
  const moves = params.get("moves") ?? "";
  const raw = params.get("cursor");
  // A missing cursor means "all moves applied", as everywhere else.
  const cursor = raw ? parseInt(raw) : decodeState(href).moves.length;
  return { moves, cursor: Number.isNaN(cursor) ? 0 : cursor };
}

/** A move rewrites the moves param; a redo advances over an unchanged one. */
export function classifyTransition(
  prev: Snapshot,
  next: Snapshot,
): Interaction | null {
  if (prev.moves === next.moves && prev.cursor === next.cursor) return null;
  if (!next.moves) return prev.moves ? "reset" : null;
  if (next.cursor < prev.cursor) return "undo";
  if (next.cursor > prev.cursor) {
    return next.moves === prev.moves ? "redo" : "move";
  }
  return null;
}

/**
 * Records one url transition. Idempotent per url, so the board's watcher and
 * the pre-post read can both call it. `asMove` lets the board assert a move
 * the url can't tell apart from a redo.
 */
export function observe(slug: string, href: string, asMove = false): void {
  const next = snapshot(href);

  if (attempt?.slug !== slug) {
    attempt = {
      slug,
      startedAt: null,
      partial: next.moves !== "",
      moves: 0,
      undos: 0,
      redos: 0,
      resets: 0,
    };
    lastSeen = next;
    return;
  }

  const seen = lastSeen;
  if (seen && seen.moves === next.moves && seen.cursor === next.cursor) return;

  const interaction = asMove ? "move" : seen && classifyTransition(seen, next);
  lastSeen = next;

  if (!interaction) return;
  // Any first interaction starts the clock; on a fresh board that is always
  // the first move, since undo and reset need moves to act on.
  if (attempt.startedAt === null) attempt.startedAt = performance.now();
  attempt[`${interaction}s` as const]++;
}

/**
 * Nothing when this page session saw no interaction at all. Resumed attempts
 * do report, flagged `partial` — their numbers are floors, so every insight
 * has to filter on it.
 */
export function readSolveTelemetry(slug: string): SolveTelemetry | undefined {
  if (attempt?.slug !== slug) return undefined;

  const { startedAt, partial, moves, undos, redos, resets } = attempt;
  if (startedAt === null) return undefined;

  return {
    durationMs: Math.round(performance.now() - startedAt),
    interactions: moves + undos + redos + resets,
    moves,
    undos,
    redos,
    resets,
    partial,
  };
}

export function resetSolveTelemetry(): void {
  attempt = null;
  lastSeen = null;
}

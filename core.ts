import { createDefine } from "fresh";

import type { User } from "#/db/types.ts";
import type { Puzzle } from "#/game/types.ts";

/**
 * Shared state passed through ctx.state in middlewares, layouts, and routes.
 * Populated by middleware/auth.ts, middleware/tracking.ts, and others.
 */
export type State = {
  // Stable anonymous user identity (UUID, httpOnly cookie)
  userId: string;

  // The users current cookie choice;
  cookieChoice: "accepted" | "declined" | null;
  // The user's tracking ID (UUID), either temporary or stored in cookie
  trackingId: string;

  // Full user record from KV (populated by middleware/user.ts)
  user: User;

  // Loaded puzzle (populated by routes/puzzles/[slug]/_middleware.ts)
  puzzle?: Puzzle;
};

export const define = createDefine<State>();

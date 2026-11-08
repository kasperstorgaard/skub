import { createDefine } from "fresh";

import type { User } from "#/db/types.ts";
import type { Progress } from "#/game/progress.ts";
import type { ScoreProgress } from "#/game/score.ts";

/**
 * Shared state passed through ctx.state in middlewares, layouts, and routes.
 * Populated by middleware/auth.ts, middleware/tracking.ts, and others.
 */
export type State = {
  // Stable anonymous user identity (UUID, httpOnly cookie)
  userId: string;
  // The auth session id, when logged in
  sessionId?: string;

  // The users current cookie choice;
  cookieChoice: "accepted" | "declined" | null;
  // The user's tracking ID (UUID), either temporary or stored in cookie
  trackingId: string;

  // Full user record from KV (populated by middleware/user.ts)
  user: User;
  // Best moves per solved puzzle (populated by middleware/user.ts)
  progress: Progress;
  // Solution score per puzzle, kept with progress (middleware/user.ts)
  score: ScoreProgress;
};

export const define = createDefine<State>();

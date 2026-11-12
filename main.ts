import { App, staticFiles } from "fresh";

import { State } from "#/core.ts";
import { backupPlayers } from "#/db/backup.ts";
import { rebuildHighscoreAbove } from "#/db/score.ts";
import { posthogProxy } from "#/middleware/posthog-proxy.ts";
import { telemetry } from "#/middleware/telemetry.ts";

// Deploy only finds crons registered at the top level.
Deno.cron("kv_backup", "0 * * * *", {
  backoffSchedule: [60_000, 300_000, 900_000],
}, backupPlayers);

// Ranks past the high score's top rows, as of the last run.
Deno.cron("highscore_above", "15 * * * *", rebuildHighscoreAbove);

export const app = new App<State>();

// Add static file serving middleware
app.use(staticFiles());

// Add middlewares
app.use(telemetry);
app.use(posthogProxy);

// Enable file-system based routing
app.fsRoutes();

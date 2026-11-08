import { App, staticFiles } from "fresh";

import { State } from "#/core.ts";
import { backupPlayers } from "#/db/backup.ts";
import { posthogProxy } from "#/middleware/posthog-proxy.ts";
import { telemetry } from "#/middleware/telemetry.ts";

// Deploy only finds crons registered at the top level. The dev server can run
// this module again, and a second registration of the name throws.
try {
  Deno.cron("kv_backup", "0 * * * *", {
    backoffSchedule: [60_000, 300_000, 900_000],
  }, backupPlayers);
} catch (err) {
  if (!(err instanceof Error && err.message.includes("already exists"))) {
    throw err;
  }
}

export const app = new App<State>();

// Add static file serving middleware
app.use(staticFiles());

// Add middlewares
app.use(telemetry);
app.use(posthogProxy);

// Enable file-system based routing
app.fsRoutes();

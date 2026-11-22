import { App, staticFiles } from "fresh";

import { State } from "#/core.ts";
import { backupPlayers } from "#/db/backup.ts";
import { isDev } from "#/lib/env.ts";
import { posthogProxy } from "#/middleware/posthog-proxy.ts";
import { telemetry } from "#/middleware/telemetry.ts";

// Deploy only finds crons registered at the top level. Not in dev: Vite
// re-runs this module on changes, and a second registration throws.
if (!isDev) {
  Deno.cron("kv_backup", "0 * * * *", {
    backoffSchedule: [60_000, 300_000, 900_000],
  }, backupPlayers);
}

export const app = new App<State>();

// Add static file serving middleware
app.use(staticFiles());

// Add middlewares
app.use(telemetry);
app.use(posthogProxy);

// Enable file-system based routing
app.fsRoutes();

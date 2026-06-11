/**
 * Whether the app is running in a local development environment.
 * _note: not available in islands_
 */
export const isDev = !Deno.env.has("DENO_DEPLOYMENT_ID");

/**
 * Builder mode — unlocks future puzzle days in the calendar.
 * Enabled by setting DEV_MODE=builder in .env.
 */
export const isBuilder = isDev && Deno.env.get("DEV_MODE") === "builder";

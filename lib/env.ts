/**
 * Whether the app is running in a local development environment.
 * _note: not available in islands_
 */
export const isDev = !Deno.env.has("DENO_DEPLOYMENT_ID");
